#include <websocketpp/config/asio_no_tls.hpp>
#include <websocketpp/server.hpp>
#include <unordered_map>
#include <string>
#include <memory>
#include <iostream>
#include <functional>
#include <chrono>
#include <nlohmann/json.hpp>

using json = nlohmann::json;
using websocketpp::connection_hdl;

class WebSocketServer {
public:
    WebSocketServer() {
        m_Server.init_asio();
        m_Server.set_open_handler(std::bind(&WebSocketServer::on_open,this,std::placeholders::_1));
        m_Server.set_close_handler(std::bind(&WebSocketServer::on_close,this,std::placeholders::_1));
        m_Server.set_message_handler(std::bind(&WebSocketServer::on_message,this,::std::placeholders::_1, std::placeholders::_2));
    }

    void run(uint16_t port) {
        m_Server.set_reuse_addr(true);
        m_Server.listen(port);
        m_Server.start_accept();
        std::cout << "WebSocket signaling server running on ws://localhost:" << port << std::endl;
        try {
            m_Server.run();
        } catch (const std::exception & e) {
            std::cout << e.what() << std::endl;
        }
    }

private:
    using Server = websocketpp::server<websocketpp::config::asio>;
    Server m_Server;

    std::unordered_map<std::string /*roomId*/, std::vector<connection_hdl> /*peers*/> m_Rooms;
    std::mutex m_LockRooms;

    void on_open(connection_hdl hdl) {
    }

    void on_close(connection_hdl hdl) {
        const std::lock_guard<std::mutex> lock(m_LockRooms);
        for (auto& [room, peers] : m_Rooms) {
            peers.erase(std::remove_if(peers.begin(), peers.end(), 
                [&hdl](const connection_hdl& peer) {
                    auto p = peer.lock();
                    return p && p == hdl.lock();
                }), 
                peers.end());
        }

        for (auto it = m_Rooms.begin(); it != m_Rooms.end(); ) {
            if (it->second.empty()) {
                it = m_Rooms.erase(it);
            } else {
                ++it;
            }
        }
    }

    void on_message(connection_hdl hdl, Server::message_ptr msg) {
        json data;
        try {
            data = json::parse(msg->get_payload());
        } catch (const json::parse_error& e) {
            std::cerr << "JSON Parse Error: " << e.what() << std::endl;
            return;
        }

        std::string type = data["type"];
        std::string room = data["room"];

        const std::lock_guard<std::mutex> lock(m_LockRooms);

        if (type == "create") {
            std::vector<connection_hdl> peers = {hdl};
            m_Rooms[room] = peers;
        } else if (type == "join") {
            if (m_Rooms.count(room)) {
                auto& peers = m_Rooms[room];
                if (peers.size() > 0) {
                    peers.push_back(hdl);
                }
            }
        } else {
            if (m_Rooms.count(room)) {
                auto& peers = m_Rooms[room];
                if (peers.size() > 1) {
                    for (auto& peer : peers) {
                        if (peer.lock() != hdl.lock()) {
                            m_Server.send(peer, msg->get_payload(), websocketpp::frame::opcode::text);
                        }
                    }
                }
            }
        } 
    }
};

int main() {
    WebSocketServer server;
    server.run(8080);
    return 0;
}
