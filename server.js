import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import crypto from 'crypto'
import bcrypt from 'bcrypt-nodejs'
import mongoose from 'mongoose'

// PORT=9000 npm start
const port = process.env.PORT || 8080
const app = express()

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost/finalproject'
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

const User = mongoose.model('User', {
  username: {
    type: String,
    unique: true
  },
  email: {
    type: String,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex')
  }
})

const Level = mongoose.model('Level', {
  value: {
    type: Number,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  }
})

const authenticateUser = async (req, res, next) => {
  const user = await User.findOne({ accessToken: req.header('Authorization') })
  if (user) {
    req.user = user
    next()
  } else {
    res.status(401).json({ loggedOut: true })
  }
}

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(bodyParser.json())

// Start defining your routes here
app.get('/', (req, res) => {
  res.send('Hello world')
})
app.get('/secrets', authenticateUser)
app.get('/secrets', (req, res) => {
  res.json({ secret: 'This is the secret' })
})

// Create new user
app.post('/users', async (req, res) => {
  try {
    const { username, email, password } = req.body
    const user = new User({
      username,
      email,
      password: bcrypt.hashSync(password)
    })
    await user.save()
    res.status(201).json({
      username: user.username,
      id: user._id,
      accessToken: user.accessToken
    })
  } catch (err) {
    console.log(err)
    res.status(400).json({
      message: 'Could not create user. Please try again!',
      errors: err.errors
    })
  }
})

// Log in
app.post('/sessions', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email })
    if (user && bcrypt.compareSync(req.body.password, user.password)) {
      res.status(201).json({
        username: user.username,
        userId: user._id,
        accessToken: user.accessToken
      })
    } else {
      res.json({ notFound: true })
    }
  } catch (err) {
    res.status(401).json({
      message: 'Username or password is incorrect',
      errors: err.errors
    })
  }
})

// Post energy level
app.post('/levels', authenticateUser)
app.post('/levels', async (req, res) => {
  const { value, date } = req.body
  const level = new Level({ value, user: req.user._id, date })
  try {
    const savedLevel = await level.save()
    res.status(201).json(savedLevel)
  } catch (err) {
    res.status(400).json({
      message: 'Could not save level',
      error: err.errors
    })
  }
})

// Get energy level
app.get('/levels', authenticateUser)
app.get('/levels', async (req, res) => {
  const levelResponse = await Level.find({ user: req.user._id })
  return res.json(levelResponse)
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
