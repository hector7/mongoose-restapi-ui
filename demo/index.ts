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
        name: String,
        number: Number
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
        required: true,
    },
    customer: [{
        ref: 'Customer', type: mongoose.Schema.Types.ObjectId
    }],
    comment: { type: String }
}))
const user = mongoose.model('User', new mongoose.Schema({
    name: String
}))
const userId = new user()
app.use((req, res, next)=>{
    req.user = userId
    next()
})
router.setGlobalRoute('')
router.setConnection(mongoose)
router.setModel('/customer', customer, { name: 'name' })
router.setModel('/provider', provider)
app.use('/', router)
app.get('/tree', router.publishUiTree())
app.listen(3030, () => {
    console.log('Express server listening on port 3000')
})
module.exports = {
    customer, provider
}