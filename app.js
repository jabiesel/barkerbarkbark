//declaring packages we install from npm into our program
const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const flash = require('connect-flash')
const markdown = require('marked')
const csrf = require('csurf')
const app = express()
const sanitizeHTML = require('sanitize-html')

app.use(express.urlencoded({extended: false}))
app.use(express.json())

app.use('/api', require('./router-api'))

// boilerplate session options to deal with data
let sessionOptions = session({
    secret:"JavaScript comment 321",
    store: MongoStore.create({client: require('./db')}),
    resave: false,
    saveUninitialied: false,
    cookie:{maxAge: 1000 * 60 * 60 * 24, httpOnly: true}
})

app.use(sessionOptions)
app.use(flash())

app.use(function(req,res,next){
    //make our markdown function available from ejs templates
    res.locals.filterUserHTML = function(content) {
        return sanitizeHTML(markdown.parse(content), {allowedTags:['p', 'br', 'ul', 'li', 'strong', 'bold', 'i', 'em', 'h1','h2','h3','h4','h5','h6'], allowedAttributes: []})
    }
    // make all error and success messages available from all templates
    res.locals.errors = req.flash("errors")
    res.locals.success = req.flash("success")
    // make current user if available on the req object
    if (req.session.user) {req.visitorId = req.session.user._id} else { req.visitorId = 0}
    // make user session data available from within view templates
    res.locals.user = req.session.user
    next()
})

const router = require('./router')
const db = require('./db')
const e = require('connect-flash')
console.log(router)


app.use(express.static('public'))
app.set('views', 'views')
app.set('view engine', 'ejs')

app.use(csrf())
app.use(function(req, res, next){
    res.locals.csrfToken = req.csrfToken()
    next()
})
app.use('/', router)

app.use(function(err, req, res, next){
    if(err){
        if(err.code == 'EBADCSRFTOKEN'){
            req.flash('errors', 'Cross site request forgery detected.')
            req.session.save(() => res.redirect('/'))
        } else {
            res.render('404')
        }
    }
})

const server = require('http').createServer(app)
const io = require('socket.io')(server)

io.use(function(socket, next){
    sessionOptions(socket.request, socket.request.res, next)
})


io.on('connection', function(socket) {
    if(socket.request.session.user){
        let user = socket.request.session.user

        socket.emit('welcome', {username: user.username, avatar: user.avatar})

        socket.on('chatMessageFromBrowser', function(data){
            socket.broadcast.emit('chatMessageFromServer', {message: sanitizeHTML(data.message, {allowedTags: [], allowedAttributes: []}), username: user.username, avatar: user.avatar})
        })
    }
})

module.exports = server