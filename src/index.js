const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateUrl } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')


const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000
const publicDirPath = path.join(__dirname, '../public')

app.use(express.static(publicDirPath))

io.on('connection', (socket) => {
    console.log('New webSocket connection')

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })
        if (error) {
            return callback(error)
        }
        
        socket.join(user.room)

        socket.emit('msg', generateMessage('Admin', `Welcome! to Chit-Chat ${user.username.toUpperCase()}`)) // send welcome msg
        socket.broadcast.to(user.room).emit('msg', generateMessage('Admin', `${user.username.toUpperCase()} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })
        callback()
    })

    socket.on('sendMessage', (msg, callback) => {
        const filter = new Filter()

        if (filter.isProfane(msg)) {
            return callback('Profanity is not allowed')
        }
        const user = getUser(socket.id)
        
        io.to(user.room).emit('msg', generateMessage(user.username, msg))
        callback()
    })

    socket.on('sendLocation', (location, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateUrl(user.username, `https://google.com/maps?q=${location.latitude},${location.longitude}`))
        callback('Location shared')
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)
        if (user){
            io.to(user.room).emit('msg', generateMessage('Admin', `${user.username.toUpperCase()} has left!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
        
    })
})
server.listen(port, () => {
    console.log(`Server is up on port ${port}`)
})