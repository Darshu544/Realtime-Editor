const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const fs = require('fs');
const ACTIONS = require('./src/Action').default || require('./src/Action');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('build'));
app.use(express.json());
app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.post('/execute', (req, res) => {
    const { code, language } = req.body;
    if (language === 'python') {
        const python = spawn('python', ['-c', code]);
        let output = '';
        let error = '';

        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        python.stderr.on('data', (data) => {
            error += data.toString();
        });

        python.on('close', (code) => {
            if (code !== 0) {
                res.json({ output: error, error: true });
            } else {
                res.json({ output, error: false });
            }
        });
    } else if (language === 'javascript') {
        try {
            const result = eval(code);
            res.json({ output: result.toString(), error: false });
        } catch (e) {
            res.json({ output: e.message, error: true });
        }
    } else if (language === 'cpp') {
        // For C++, write to temp file, compile and run
        const tempFile = path.join(__dirname, 'temp.cpp');
        const exeFile = path.join(__dirname, 'temp.exe');

        fs.writeFileSync(tempFile, code);

        const compile = spawn('g++', [tempFile, '-o', exeFile]);

        compile.on('close', (code) => {
            if (code !== 0) {
                res.json({ output: 'Compilation failed', error: true });
                return;
            }

            const run = spawn(exeFile);
            let output = '';
            let error = '';

            run.stdout.on('data', (data) => {
                output += data.toString();
            });

            run.stderr.on('data', (data) => {
                error += data.toString();
            });

            run.on('close', () => {
                fs.unlinkSync(tempFile);
                fs.unlinkSync(exeFile);
                res.json({ output: output || error, error: !!error });
            });
        });
    } else {
        res.json({ output: 'Language not supported', error: true });
    }
});

const userSocketMap = {};
function getAllConnectedClients(roomId) {
    // Get all socket IDs in the room
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || room.size === 0) {
        console.log(`Room ${roomId} is empty or doesn't exist`);
        return [];
    }
    
    // Map socket IDs to client objects with usernames
    const clients = Array.from(room).map((socketId) => {
        const username = userSocketMap[socketId] || 'Anonymous';
        return {
            socketId,
            username,
        };
    });
    
    console.log(`getAllConnectedClients for room ${roomId}: Found ${clients.length} clients`);
    clients.forEach((client, index) => {
        console.log(`  ${index + 1}. ${client.username} (${client.socketId})`);
    });
    
    return clients;
}

io.on('connection', (socket) => {
    console.log('\n✅ NEW SOCKET CONNECTION:', socket.id);
    console.log('   Total connected sockets:', io.sockets.sockets.size);
    
    // Test basic communication
    socket.emit('test-event', { message: 'Server connection test', timestamp: Date.now() });
    console.log('   Sent test event to', socket.id);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        console.log(`\n🔵 SERVER: Received JOIN event`);
        console.log(`   User: ${username}`);
        console.log(`   Socket ID: ${socket.id}`);
        console.log(`   Room ID: ${roomId}`);
        console.log(`   ACTIONS.JOINED value: "${ACTIONS.JOINED}"`);
        
        if (!roomId || !username) {
            console.error('❌ Missing roomId or username in JOIN event');
            return;
        }
        
        userSocketMap[socket.id] = username;
        
        // Join the room and wait for it to complete
        socket.join(roomId, () => {
            // This callback ensures socket is fully joined
            const clients = getAllConnectedClients(roomId);
            console.log(`\n🔵 User ${username} (${socket.id}) joined room ${roomId}`);
            console.log(`Room ${roomId} now has ${clients.length} clients:`, JSON.stringify(clients, null, 2));
            
            // Verify the current user is in the list
            const currentUserInList = clients.find(c => c.socketId === socket.id);
            if (!currentUserInList) {
                console.error('❌ Current user not found in clients list!');
            } else {
                console.log('✅ Current user found in clients list');
            }
            
            // Get all sockets in the room for logging
            const roomSockets = io.sockets.adapter.rooms.get(roomId);
            console.log(`Room ${roomId} has ${roomSockets ? roomSockets.size : 0} sockets`);
            
            // CRITICAL: Use io.in() to emit to ALL sockets in the room (including the one who just joined)
            const joinedEventData = {
                clients,
                username,
                socketId: socket.id,
            };
            
            console.log(`📢 Broadcasting JOINED event with event name: "${ACTIONS.JOINED}"`);
            console.log(`   Event data:`, JSON.stringify(joinedEventData, null, 2));
            
            io.in(roomId).emit(ACTIONS.JOINED, joinedEventData);
            
            // Also try with string literal as backup
            io.in(roomId).emit('joined', joinedEventData);
            
            console.log(`📢 JOINED event broadcasted to ALL ${roomSockets ? roomSockets.size : 0} sockets in room ${roomId}`);
            console.log(`   Clients list contains ${clients.length} users`);
            clients.forEach((c, i) => {
                console.log(`   ${i + 1}. ${c.username} (${c.socketId})`);
            });
            console.log('');
            
            // Notify existing users to send their code to the new user
            socket.to(roomId).emit(ACTIONS.SYNC_CODE, { targetSocketId: socket.id });
        });
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code, language, languageVersion }) => {
        if (!roomId) {
            console.error('❌ No roomId in CODE_CHANGE event');
            return;
        }
        
        console.log(`\n📝 CODE_CHANGE from ${socket.id} in room ${roomId}`);
        console.log(`   Code: ${code ? code.length : 0} chars, Lang: ${language || 'N/A'}, Ver: ${languageVersion || 'N/A'}`);
        
        // Get all sockets in the room
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        const roomSize = roomSockets ? roomSockets.size : 0;
        
        if (roomSize === 0) {
            console.warn('⚠️ Room is empty, cannot broadcast');
            return;
        }
        
        // Prepare event data
        const eventData = { code, language, languageVersion };
        
        // Broadcast to all OTHER sockets (excluding sender) - use socket.to() which is most reliable
        socket.to(roomId).emit(ACTIONS.CODE_CHANGE, eventData);
        socket.to(roomId).emit('code-change', eventData);
        
        // Also manually send to each socket as backup
        const otherSockets = Array.from(roomSockets || []).filter(id => id !== socket.id);
        otherSockets.forEach(socketId => {
            io.to(socketId).emit(ACTIONS.CODE_CHANGE, eventData);
            io.to(socketId).emit('code-change', eventData);
        });
        
        console.log(`✅ Broadcasted to ${otherSockets.length} other socket(s)`);
    });
    
    // Also listen for string literal version as backup
    socket.on('code-change', ({ roomId, code, language, languageVersion }) => {
        if (!roomId) return;
        
        const eventData = { code, language, languageVersion };
        socket.to(roomId).emit(ACTIONS.CODE_CHANGE, eventData);
        socket.to(roomId).emit('code-change', eventData);
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        // Send code to a specific socket (used when existing users send code to new users)
        if (socketId && code !== undefined) {
            io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
        }
    });

    // Handle request for current clients list
    socket.on(ACTIONS.REQUEST_CLIENTS, ({ roomId }) => {
        console.log(`\n📥 SERVER: Received REQUEST_CLIENTS from ${socket.id} for room ${roomId}`);
        if (roomId) {
            const clients = getAllConnectedClients(roomId);
            console.log(`📤 Sending clients list to ${socket.id} for room ${roomId}:`, clients.length, 'clients');
            
            const joinedEventData = {
                clients,
                username: userSocketMap[socket.id] || 'Unknown',
                socketId: socket.id,
            };
            
            console.log(`   Event data:`, JSON.stringify(joinedEventData, null, 2));
            
            // Send with both constant and string literal
            socket.emit(ACTIONS.JOINED, joinedEventData);
            socket.emit('joined', joinedEventData);
            
            // Also try with a direct test
            socket.emit('test-joined', joinedEventData);
            
            console.log(`✅ Sent JOINED event to ${socket.id} using:`);
            console.log(`   - ${ACTIONS.JOINED}`);
            console.log(`   - "joined"`);
            console.log(`   - "test-joined"`);
        } else {
            console.error('❌ No roomId in REQUEST_CLIENTS');
        }
    });
    
    // Also listen for the string literal version
    socket.on('request-clients', ({ roomId }) => {
        console.log(`\n📥 SERVER: Received "request-clients" (string) from ${socket.id} for room ${roomId}`);
        if (roomId) {
            const clients = getAllConnectedClients(roomId);
            const joinedEventData = {
                clients,
                username: userSocketMap[socket.id] || 'Unknown',
                socketId: socket.id,
            };
            socket.emit('joined', joinedEventData);
            console.log(`✅ Sent "joined" event to ${socket.id}`);
        }
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));