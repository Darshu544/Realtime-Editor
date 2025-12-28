import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import ACTIONS from '../Action.js';
import Client from '../components/Client';
import Editor from '../components/Editor';
import { initSocket } from '../socket';
import {
    useLocation,
    useNavigate,
    Navigate,
    useParams,
} from 'react-router-dom';

const EditorPage = () => {
    const socketRef = useRef(null);
    const codeRef = useRef(null);
    const location = useLocation();
    const { roomId } = useParams();
    const reactNavigator = useNavigate();
    const [clients, setClients] = useState([]);

    useEffect(() => {
        let handleConnect;
        const currentUsername = location.state?.username || 'Anonymous';
        
        // Immediately show current user in the list as fallback
        setClients([{
            socketId: 'current-user-temp',
            username: currentUsername
        }]);

        const init = async () => {
            socketRef.current = await initSocket();
            socketRef.current.on('connect_error', (err) => handleErrors(err));
            socketRef.current.on('connect_failed', (err) => handleErrors(err));
            
            // Test basic socket communication
            socketRef.current.on('connect', () => {
                console.log('✅ Socket connected successfully, ID:', socketRef.current.id);
                console.log('Socket connected state:', socketRef.current.connected);
            });
            
            // Listen for any event to test communication
            socketRef.current.onAny((eventName, ...args) => {
                console.log(`📨 Received event: ${eventName}`, args);
            });

            function handleErrors(e) {
                console.log('socket error', e);
                toast.error('Socket connection failed, try again later.');
                reactNavigator('/');
            }

            // Set up JOINED event listener - use string literal to ensure it works
            const joinedHandler = ({ clients, username, socketId }) => {
                    console.log('=== JOINED EVENT RECEIVED ===');
                    console.log('Received from socket:', socketId);
                    console.log('Current socket ID:', socketRef.current?.id);
                    console.log('Username in event:', username);
                    console.log('Current username:', currentUsername);
                    console.log('Clients array received:', JSON.stringify(clients, null, 2));
                    console.log('Clients count:', clients ? clients.length : 0);
                    
                    // ALWAYS update clients list from server, even if empty (server is source of truth)
                    if (clients && Array.isArray(clients)) {
                        console.log('Updating clients list with', clients.length, 'users');
                        setClients(clients);
                        
                        // Log each client for debugging
                        clients.forEach((client, index) => {
                            console.log(`  Client ${index + 1}: ${client.username} (${client.socketId})`);
                        });
                    } else {
                        console.error('Invalid clients array received:', clients);
                    }
                    
                    // If this is a new user joining (not the current user), notify
                    if (socketId && socketId !== socketRef.current?.id) {
                        toast.success(`${username} joined the room.`);
                        console.log(`✅ ${username} joined the room`);
                    } else if (socketId === socketRef.current?.id) {
                        console.log('✅ Current user joined/updated in room');
                    }
                    console.log('=== END JOINED EVENT ===');
                };
            
            // Register the event listener with both the constant and string literal
            socketRef.current.on(ACTIONS.JOINED, joinedHandler);
            socketRef.current.on('joined', joinedHandler); // Backup with string literal
            socketRef.current.on('test-joined', joinedHandler); // Another backup
            
            // Also test with a test event
            socketRef.current.on('test-event', (data) => {
                console.log('✅ Test event received from server:', data);
            });
            
            console.log('✅ JOINED event listener registered');
            console.log('   - Listening for:', ACTIONS.JOINED);
            console.log('   - Listening for: "joined"');
            console.log('   - Listening for: "test-joined"');
            console.log('   - Socket ID:', socketRef.current.id);
            console.log('   - Socket connected:', socketRef.current.connected);

            // Wait for socket to be connected before joining
            handleConnect = () => {
                console.log('Socket connected:', socketRef.current.id);
                
                // Small delay to ensure event listener is registered
                setTimeout(() => {
                    // Emit JOIN event after connection is established
                    socketRef.current.emit(ACTIONS.JOIN, {
                        roomId,
                        username: currentUsername,
                    });
                    console.log('JOIN event emitted for room:', roomId, 'username:', currentUsername);
                    
                    // Also request clients list multiple times as a backup to ensure we get the list
                    setTimeout(() => {
                        socketRef.current.emit(ACTIONS.REQUEST_CLIENTS, { roomId });
                        console.log('REQUEST_CLIENTS event emitted for room:', roomId);
                    }, 500);
                    
                    // Request again after 1 second
                    setTimeout(() => {
                        socketRef.current.emit(ACTIONS.REQUEST_CLIENTS, { roomId });
                        console.log('REQUEST_CLIENTS event emitted again (backup) for room:', roomId);
                    }, 1000);
                    
                    // Set up periodic refresh every 2 seconds to ensure clients list stays updated
                    const refreshInterval = setInterval(() => {
                        if (socketRef.current && socketRef.current.connected) {
                            socketRef.current.emit(ACTIONS.REQUEST_CLIENTS, { roomId });
                            console.log('Periodic REQUEST_CLIENTS for room:', roomId);
                        } else {
                            clearInterval(refreshInterval);
                        }
                    }, 2000);
                    
                    // Store interval to clear on cleanup
                    socketRef.current._refreshInterval = refreshInterval;
                }, 100);
            };

            // If already connected, join immediately; otherwise wait for connect event
            if (socketRef.current.connected) {
                handleConnect();
            } else {
                socketRef.current.on('connect', handleConnect);
            }

            // Listen for sync code request (when a new user joins, existing users send their code)
            socketRef.current.on(ACTIONS.SYNC_CODE, ({ targetSocketId }) => {
                if (targetSocketId && codeRef.current) {
                    // Send current code to the new user
                    socketRef.current.emit(ACTIONS.SYNC_CODE, {
                        socketId: targetSocketId,
                        code: codeRef.current,
                    });
                }
            });

            // Listening for disconnected
            socketRef.current.on(
                ACTIONS.DISCONNECTED,
                ({ socketId, username }) => {
                    toast.success(`${username} left the room.`);
                    setClients((prev) => {
                        return prev.filter(
                            (client) => client.socketId !== socketId
                        );
                    });
                }
            );
        };
        init();
        return () => {
            if (socketRef.current) {
                // Clear periodic refresh interval
                if (socketRef.current._refreshInterval) {
                    clearInterval(socketRef.current._refreshInterval);
                }
                
                socketRef.current.off(ACTIONS.JOINED);
                socketRef.current.off(ACTIONS.DISCONNECTED);
                socketRef.current.off(ACTIONS.SYNC_CODE);
                if (handleConnect) {
                    socketRef.current.off('connect', handleConnect);
                }
                socketRef.current.disconnect();
            }
        };
    }, [location.state?.username, reactNavigator, roomId, location]);

    async function copyRoomId() {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID has been copied to your clipboard');
        } catch (err) {
            toast.error('Could not copy the Room ID');
            console.error(err);
        }
    }

    function leaveRoom() {
        reactNavigator('/');
    }

    if (!location.state) {
        return <Navigate to="/" />;
    }

    return (
        <div className="mainWrap">
            <div className="aside">
                <div className="asideInner">
                    <div className="logo">
                        <img
                            className="logoImage"
                            src="/code-sync.png"
                            alt="logo"
                        />
                    </div>
                    <h3>Connected ({clients.length})</h3>
                    <div className="clientsList">
                        {clients.length === 0 ? (
                            <div style={{ color: '#888', fontStyle: 'italic', padding: '10px' }}>
                                <Client username={location.state?.username || 'Anonymous'} />
                            </div>
                        ) : (
                            clients.map((client) => {
                                console.log('Rendering client in list:', client);
                                if (!client || !client.username) {
                                    console.warn('Invalid client data:', client);
                                    return null;
                                }
                                return (
                                    <Client
                                        key={client.socketId || Math.random()}
                                        username={client.username}
                                    />
                                );
                            })
                        )}
                    </div>
                </div>
                <button className="btn copyBtn" onClick={copyRoomId}>
                    Copy ROOM ID
                </button>
                <button className="btn leaveBtn" onClick={leaveRoom}>
                    Leave
                </button>
            </div>
            <div className="editorWrap">
                <Editor
                    socketRef={socketRef}
                    roomId={roomId}
                    onCodeChange={(code) => {
                        codeRef.current = code;
                    }}
                />
            </div>
        </div>
    );
};

export default EditorPage;