sudo systemctl restart docker
sudo systemctl restart mongod
cd /home/eteknas/Projects/easystack-backend/infra/storage
sudo docker-compose up -d