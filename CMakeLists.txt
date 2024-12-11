cmake_minimum_required(VERSION 3.10)
project(WebRtc)

set(CMAKE_CXX_STANDARD 17)

find_package(Boost REQUIRED COMPONENTS system)

if (Boost_FOUND)
    include_directories(${Boost_INCLUDE_DIRS})
    message(STATUS "Boost found: ${Boost_INCLUDE_DIRS}")
else()
    message(FATAL_ERROR "Boost not found!")
endif()

add_executable(signaling_server)

target_sources(signaling_server
  PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/signaling_server.cpp
)

target_include_directories(signaling_server
  PRIVATE 
    ${CMAKE_CURRENT_SOURCE_DIR}/3rd/websocketpp
    ${CMAKE_CURRENT_SOURCE_DIR}/3rd/json/include
)

target_link_libraries(signaling_server PRIVATE ${Boost_LIBRARIES} pthread)


add_executable(api_server)

target_sources(api_server
  PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/api_server.cpp
)

target_include_directories(api_server
  PRIVATE 
    ${CMAKE_CURRENT_SOURCE_DIR}/3rd/Crow/include
)
target_link_libraries(api_server PRIVATE ${Boost_LIBRARIES} pthread)

target_compile_definitions(api_server PRIVATE -DCROW_USE_BOOST)
