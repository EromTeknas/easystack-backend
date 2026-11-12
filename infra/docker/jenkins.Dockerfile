# syntax=docker/dockerfile:1
FROM jenkins/jenkins:lts-jdk17

USER root

# Install official Docker CLI, Docker Compose plugin, and build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        git \
        jq && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    chmod a+r /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        docker-ce-cli \
        docker-compose-plugin && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Add jenkins user to standard docker group (gid 999 or 998 or 140 depending on host)
RUN groupadd -f -g 999 docker && \
    groupadd -f -g 998 docker-host && \
    groupadd -f -g 140 docker-socket && \
    usermod -aG docker jenkins && \
    usermod -aG docker-host jenkins && \
    usermod -aG docker-socket jenkins

USER jenkins

EXPOSE 8080 50000
