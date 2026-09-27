FROM ubuntu:24.04

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends tor snowflake-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY torrc /etc/tor/torrc

USER debian-tor
CMD ["tor", "-f", "/etc/tor/torrc"]
