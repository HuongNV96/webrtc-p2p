FROM ubuntu:20.04
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update
RUN apt-get install libboost-all-dev build-essential g++ cmake -y

WORKDIR /usr/src/app
COPY . .
RUN cmake . && make
CMD ["./signaling_server"]
