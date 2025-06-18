# Managist - Enterprise Management Application

## Prerequisites

### System Requirements
- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **Rust** (latest stable) - [Install via rustup](https://rustup.rs/)
- **PostgreSQL** (v12 or higher) - [Download here](https://www.postgresql.org/download/)

### Platform-specific Requirements

#### Windows
- Microsoft Visual C++ Build Tools
- Windows 10 version 1903 or higher

#### macOS
- Xcode Command Line Tools
- macOS 10.15 or higher

#### Linux
- Build essentials (gcc, make, etc.)
- WebKit2GTK development packages
- SSL development libraries

## Automatic Database Setup ✨

**Good news!** This application now automatically sets up the database and creates all necessary tables when you run it for the first time. No manual database configuration required!

### What happens automatically:
1. **Database Creation**: If the database doesn't exist, it will be created automatically
2. **Table Creation**: All necessary tables (users, employees, projects, buyers) are created
3. **Default Admin User**: A default admin account is created for first-time login
   - Username: `admin`
   - Password: `admin123`
   - **⚠️ Please change this password after first login!**

### Prerequisites
You only need to have **PostgreSQL installed and running** on your system. That's it!

### Quick Start
1. Install PostgreSQL (if not already installed)
2. Start PostgreSQL service
3. Run the application using `npm run tauri:dev` or `npm run tauri:build`
4. The application will handle everything else automatically!

## Manual Database Setup (Optional)

If you prefer to set up the database manually or need custom configuration:

```sql
-- Connect to PostgreSQL as superuser
CREATE DATABASE managist_db;
CREATE USER managist_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE managist_db TO managist_user;
```

### 3. Configure Database Connection
Create a `.env` file in the project root with your database credentials:

```env
DATABASE_URL=postgres://managist_user:your_secure_password@localhost:5432/managist_db
```

**Note**: Replace `your_secure_password` with a secure password of your choice.

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd My-application
```

### 2. Install Dependencies
```bash
# Install Node.js dependencies
npm install

# Install Rust dependencies (will be handled automatically during build)
```

### 3. Environment Setup
Copy the environment template and configure your database:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

## Running the Application

### Development Mode
```bash
npm run tauri dev
```

### Production Build
```bash
npm run tauri build
```

## Testing Database Auto-Setup

To test the automatic database initialization:

**Windows:**
```bash
./test_db_init.bat
```

**Linux/macOS:**
```bash
chmod +x test_db_init.sh
./test_db_init.sh
```

Or simply run the application and check the console output for database initialization messages.

## Features

- **Employee Management**: Add, edit, delete, and search employees
- **Salary Management**: Calculate and track employee salaries
- **Project Management**: Manage construction projects and buyers
- **User Authentication**: Secure login system with admin/employee roles
- **Database Integration**: Full PostgreSQL integration with automatic migrations

## Project Structure

```
My-application/
├── src/                    # Frontend source code
│   ├── dashboard/         # Dashboard pages
│   ├── assets/            # Static assets
│   └── utils/             # Utility functions
├── src-tauri/             # Backend Rust code
│   └── src/               # Rust source files
├── package.json           # Node.js dependencies
└── README.md             # This file
```

## Database Schema

The application automatically creates the following tables:
- `users` - User authentication
- `employees` - Employee data
- `projects` - Project information
- `buyers` - Project buyers/customers

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL is running
   - Verify database credentials in `.env`
   - Check if the database exists

2. **Build Errors**
   - Make sure all prerequisites are installed
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Clear Rust cache: `cargo clean`

3. **Permission Errors (Linux/macOS)**
   - Ensure your user has proper permissions
   - Install system dependencies as needed

### Getting Help

If you encounter issues:
1. Check this README for troubleshooting steps
2. Verify all prerequisites are installed
3. Check the console for error messages
4. Ensure database is properly configured

## License

[Add your license information here]
