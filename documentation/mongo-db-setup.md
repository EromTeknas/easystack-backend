# MongoDB Setup Guide (From Scratch)

This document explains how to install, configure, secure, and connect to MongoDB for local or production use.

## 1. Prerequisites

- Linux / macOS / Windows
- MongoDB Server
- MongoDB Shell (`mongosh`)
- MongoDB Compass (optional but recommended)
- Node.js / backend runtime (if applicable)

## 2. Install MongoDB

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y mongodb-org
```

Start and enable MongoDB:

```bash
sudo systemctl start mongod
sudo systemctl enable mongod
```

Verify:

```bash
mongod --version
```

### macOS (Homebrew)

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

### Windows

- Download from: https://www.mongodb.com/try/download/community
- Install MongoDB Server
- Install MongoDB Compass
- Ensure MongoDB runs as a Windows Service

## 3. Verify MongoDB is Running

```bash
mongosh
```

Expected output:

```
Current Mongosh Log ID: ...
Connecting to: mongodb://127.0.0.1:27017/
```

Exit shell:

```bash
exit
```

## 4. Create Database

MongoDB creates databases automatically when data is inserted.

Switch to your database:

```bash
use myapp_db
```

Confirm:

```bash
db
```

## 5. Create Application User (Recommended)

### Switch to admin database

```bash
use admin
```

### Create user

```javascript
db.createUser({
  user: "myapp_user",
  pwd: "StrongP@ssw0rd!2025",
  roles: [
    { role: "readWrite", db: "myapp_db" }
  ]
})
```

✔ User has access only to `myapp_db`  
✔ Avoid using root user in applications

## 6. Enable Authentication (IMPORTANT)

### Edit MongoDB config:

```bash
sudo nano /etc/mongod.conf
```

### Enable security:

```yaml
security:
  authorization: enabled
```

### Restart MongoDB:

```bash
sudo systemctl restart mongod
```

## 7. Login with Authentication

```bash
mongosh -u myapp_user -p --authenticationDatabase admin
```

Enter password when prompted.

## 8. MongoDB Connection URI

**Raw format (DO NOT use if password has special characters):**

```
mongodb://username:password@host:port/database
```

## 9. URL-Encode Password (Required if using special characters)

**Example password:**
```
StrongP@ssw0rd!2025
```

**Encoded password:**
```
StrongP%40ssw0rd%212025
```

Encode using JavaScript:

```javascript
encodeURIComponent("StrongP@ssw0rd!2025")
```

## 10. Environment Variable Setup

Create `.env` file:

```env
MONGODB_URI=mongodb://myapp_user:StrongP%40ssw0rd%212025@localhost:27017/myapp_db
```

❗ **Encode only the password, not the entire URI.**

## 11. Connect from Application (Node.js Example)

### Using Mongoose

```javascript
import mongoose from "mongoose";

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));
```

## 12. Recommended MongoDB Settings

### Storage Engine

- Default: WiredTiger (recommended)
- Compression enabled by default

### Indexing

Create indexes early for performance:

```javascript
db.users.createIndex({ email: 1 }, { unique: true })
```

## 13. Backup Strategy (Essential)

### Manual backup

```bash
mongodump --db myapp_db --out ./backup
```

### Restore

```bash
mongorestore ./backup
```

### Recommendation

- Daily automated backups
- Store backups off-server (S3, GCS, etc.)

## 14. Security Best Practices

✔ Enable authentication  
✔ Use non-root DB users  
✔ Bind MongoDB to localhost (default)  
✔ Do NOT expose port 27017 publicly  
✔ Use strong passwords  
✔ Always encode passwords in URIs  
✔ Never commit `.env` to git  

## 15. Production Recommendations

- Enable TLS/SSL
- Use replica sets (even single-node)
- Monitor with MongoDB Atlas / Prometheus
- Set memory limits on low-RAM servers
- Enable slow query logging

## 16. Common Issues & Fixes

### Authentication failed

- Ensure correct `authSource=admin`
- Ensure password is URL-encoded

### Connection timeout

- Check MongoDB is running
- Check firewall rules
- Verify port 27017

## 17. Quick Checklist

- [ ] MongoDB installed
- [ ] Database created
- [ ] App user created
- [ ] Auth enabled
- [ ] Password encoded
- [ ] `.env` configured
- [ ] App connected

## 18. References

- https://www.mongodb.com/docs/
- https://www.mongodb.com/security
- https://www.mongodb.com/try/download/compass