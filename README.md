

# ⚡ Realtime Code Editor

A **basic real-time code editor** where users can **join an auto-generated room**, **select a programming language and version**, **write and run code**, and **share code in real time** with other users in the same room.

This project focuses on **real-time code sharing**, not advanced IDE features.

---

## ✨ Features

* 🔗 **Auto-generate new Room ID**
* 🧑‍🤝‍🧑 **Join room using Room ID**
* 🌐 **Real-time code sharing**
* 🧠 **Language selection**
* 🔢 **Language version selection**
* ▶️ **Run code**
* 📤 **Share code with others in the same room**
* 🎯 Simple UI and easy to use

---

## 🧠 How the Application Works

1. User opens the application
2. A **new Room ID is generated automatically**
3. User selects:

   * Programming language
   * Language version
4. Other users join using the same Room ID
5. Code typed by one user is **instantly synchronized**
6. Code can be **executed (run)** inside the editor

---

## 🧰 Tech Stack

| Layer           | Technology    |
| --------------- | ------------- |
| Frontend        | React         |
| Backend         | Node.js       |
| Real-Time       | Socket.IO     |
| Code Execution  | Backend / API |
| Styling         | CSS           |
| Package Manager | npm           |

---

## 📁 Project Folder Structure

```
realtime-editor/
│
├── build/                  # Production build files
├── node_modules/           # Dependencies
├── public/                 # Public assets
│
├── src/
│   ├── components/         # Reusable UI components
│   ├── pages/              # Application pages
│   │   ├── Home.js         # Home / Room join page
│   │   └── EditorPage.js   # Code editor page
│   │
│   ├── Action.js           # Editor actions & constants
│   ├── socket.js           # Socket.IO client configuration
│   ├── App.js              # Main App component
│   ├── App.css             # App styles
│   ├── index.js            # React entry point
│   ├── index.css           # Global styles
│   ├── App.test.js
│   ├── reportWebVitals.js
│   └── setupTests.js
│
├── server.js               # Node.js + Socket.IO server
├── .env                    # Environment variables
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── TODO.md
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the repository

```bash
git clone https://github.com/Darshu544/Realtime-Editor.git
cd realtime-editor
```

---

### 2️⃣ Install dependencies

```bash
npm install
```

---

### 3️⃣ Start the application

```bash
npm start
```

* Frontend runs on:
  👉 `http://localhost:3000`
* Backend runs using `server.js`

---

## 📌 Available Scripts

| Command         | Description                      |
| --------------- | -------------------------------- |
| `npm start`     | Runs the app in development mode |
| `npm run build` | Builds app for production        |
| `npm test`      | Runs test cases                  |

---

## 🎯 Use Cases

* Basic code sharing
* Live coding practice
* Pair programming (basic level)
* College mini / final year project
* Online demonstrations

---

## 🔮 Future Improvements (Optional)

* User authentication
* Chat feature
* More languages
* Save code history
* File-based editing

---


## 👨‍💻 Author

**Darshan Memane**
GitHub: [https://github.com/Darshu544](https://github.com/Darshu544)

---


Just tell me 👍
