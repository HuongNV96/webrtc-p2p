#include "crow.h"
#include <set>
#include <string>
#include <random>
#include <sstream>

struct CORS {
    struct context {};

    void before_handle(crow::request& /*req*/, crow::response& /*res*/, context& /*ctx*/) {
        // No action before handling the request
    }

    void after_handle(crow::request& /*req*/, crow::response& res, context& /*ctx*/) {
        res.add_header("Access-Control-Allow-Origin", "*");
        res.add_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.add_header("Access-Control-Allow-Headers", "Content-Type");
    }
};

class RomManager {
  public :
    std::string generateUniqueRoomId() {
        std::string roomId;
        {
            do {
                roomId = generateRoomId();
            } while (!m_Rooms.insert(roomId).second);
        }
        return roomId;
    }

    bool roomExist(std::string roomId) {
        std::lock_guard<std::mutex> lock(m_LockRooms);
        return m_Rooms.find(roomId) != m_Rooms.end();
    }

  private :
    std::mutex m_LockRooms;
    std::set<std::string> m_Rooms;

    // Function to generate a random 6-character room ID
    std::string generateRoomId() const noexcept {
        std::string roomId;
        std::random_device rd;
        std::mt19937 gen(rd());
        std::uniform_int_distribution<int> dis(0, 35); // 26 letters + 10 digits

        for (int i = 0; i < 6; ++i) {
            int randomValue = dis(gen);
            if (randomValue < 26) {
                roomId += 'a' + randomValue; // Lowercase letters
            } else {
                roomId += '0' + (randomValue - 26); // Digits
            }
        }
        return roomId;
    }
};


int main() {
    crow::App<CORS> app;
    RomManager romManager;


    // Serve static files from the "static" directory
    app.route_dynamic("/static")
    ([](const crow::request& req, crow::response& res) {
        res.set_static_file_info(req.url_params.get("path"));
        res.end();
    });

    // Route to serve the index.html
    CROW_ROUTE(app, "/")
    ([](crow::response& res){
        res.set_static_file_info("static/index.html");
        res.end();
    });

    // Endpoint to create a new room
    CROW_ROUTE(app, "/createRoom")
    ([&romManager]() {
        std::string roomId = romManager.generateUniqueRoomId();
        crow::json::wvalue response;
        response["roomId"] = roomId;
        return response;
    });

    // Endpoint to check if a room exists
    CROW_ROUTE(app, "/checkRoom")
    ([&romManager](const crow::request& req) {
        auto roomId = req.url_params.get("id");
        crow::json::wvalue response;
        if (roomId) {
            response["exists"] = romManager.roomExist(roomId);
        } else {
            response["exists"] = false; // Missing parameter
        }
        return response;
    });

    // Start the server
    app.port(3000).multithreaded().run();
    return 0;
}
