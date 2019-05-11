const express = require('express')
const bodyParser = require('body-parser')
import mongoose = require('mongoose')
const app = express()
import { ApiRouter } from '../src/router'

app.use(bodyParser.json())

mongoose.connect('mongodb://localhost:27017/database')
const router = ApiRouter()

const customer = mongoose.model('Customer', new mongoose.Schema({
    complex: {
        name: { type: String },
        number: { type: Number, label: true }
    },
    name: { type: String, required: true },
    comment: { type: String },
    arraycomment: [{ type: String }],
    arrayint: [{ type: Number }],
    arrayDate: [{ type: Date }],
    dateField: { type: Date }
}))
const provider = mongoose.model('Provider', new mongoose.Schema({
    name: {
        type: [{ hola: { type: String, required: true, label: true }, adios: { type: String, required: true } }],
        required: true
    },
    complex: {
        label: { type: String, label: true }
    },
    complexArrayRef: [{
        name: String,
        customer: { ref: 'Customer', type: mongoose.Schema.Types.ObjectId, label: true }
    }],
    customer: [{
        ref: 'Customer', type: mongoose.Schema.Types.ObjectId
    }],
    comment: { type: String }
}))
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    super_admin: Boolean,
    roles: [mongoose.Schema.Types.ObjectId]
}))
const userId = new User({ super_admin: true })
app.use((req, res, next) => {
    req.user = userId
    next()
})
router.setConnection(mongoose)
router.setModel('/customer', customer, { name: 'name', hasAddPermission: (req, cb) => cb(null, true) })
router.setModel('/provider', provider, { hasAddPermission: (req, cb) => cb(null, true) })
router.setRoleEndpoints()
app.use('/', router)
app.get('/tree', router.publishUiTree())
app.listen(3030, () => {
    console.log('Express server listening on port 3000')
})
module.exports = {
    customer, provider
}