import "mocha-typescript";
import getQuery, { CtxType, Query } from '../src/models/query'
import mongoose = require("mongoose");
import { Schema, Document, Types } from 'mongoose'


const EMPTY_MODEL = 'Empty'
const CUSTOMER = 'Customer'
const PROVIDER = 'Provider'
const MULTIPROVIDER = 'MultiProvider'

type ICustomer = {

    name?: string,
    number?: number,
    boolean?: boolean,
    boolean2?: boolean,
    date?: Date,
    objectid?: Types.ObjectId,
}
type IProvider = {
    ref: Types.ObjectId,
    name: String
}
type IMultiProvider = {
    ref: Types.ObjectId
    ref2: Types.ObjectId
}

const customerSchema = new Schema({
    name: String,
    number: Number,
    boolean: Boolean,
    boolean2: Boolean,
    date: Date,
    objectid: Schema.Types.ObjectId
})

const emptySchema = new Schema({})

const providerSchema = new Schema({
    ref: { type: Schema.Types.ObjectId, ref: CUSTOMER },
    name: String
})
const multiProviderSchema = new Schema({
    ref: { type: Schema.Types.ObjectId, ref: CUSTOMER },
    ref2: { type: Schema.Types.ObjectId, ref: CUSTOMER }
})

type ICustomerModel = ICustomer & Document
type IProviderModel = IProvider & Document
type IMultiProviderModel = IMultiProvider & Document

type IEmptyModel = Document
describe('SimpleQueryTest', () => {
    const date: Date = new Date()
    const objid = new Types.ObjectId('12a456789012345678901234')
    //store test data
    var customerData: Partial<ICustomerModel>[] = [{
        name: 'hector',
        number: 1,
        boolean: true,
        objectid: objid
    }, {
        name: 'jose',
        number: 2,
        boolean: true
    }, {
        name: 'Alice',
        number: 543210,
        date: date,
        boolean2: true
    }]
    var EmptyModel: mongoose.Model<IEmptyModel>;
    //the Customer model
    var Customer: mongoose.Model<ICustomerModel>;
    //the Provider model
    var Provider: mongoose.Model<IProviderModel>;
    //the Provider model
    var MultiProvider: mongoose.Model<IMultiProviderModel>;

    var connection: mongoose.Connection
    const EmptyCtx: CtxType = {
        fullPathTypes: {},
        numberFullPaths: [],
        refFullPaths: [],
        stringFullPaths: [],
        dateFullPaths: [],
        booleanFullPaths: [],
        objectIdFullPaths: [],
    }
    const CustomerCtx: CtxType = {
        fullPathTypes: {
            name: {
                type: 'String'
            },
            number: {
                type: 'Number'
            },
            boolean: {
                type: 'Boolean'
            },
            boolean2: {
                type: 'Boolean'
            },
            date: {
                type: 'Date'
            },
            objectid: {
                type: 'ObjectId'
            },
        },
        numberFullPaths: ['number'],
        refFullPaths: [],
        stringFullPaths: ['name'],
        dateFullPaths: ['date'],
        booleanFullPaths: ['boolean', 'boolean2'],
        objectIdFullPaths: ['objectid'],
    }
    const ProviderCtx: CtxType = {
        fullPathTypes: {
            ref: {
                type: 'Ref',
                to: CUSTOMER
            },
            name: {
                type: 'String'
            }
        },
        numberFullPaths: [],
        refFullPaths: ['ref'],
        dateFullPaths: [],
        objectIdFullPaths: [],
        booleanFullPaths: [],
        stringFullPaths: ['name'],
    }
    const MultiProviderCtx: CtxType = {
        fullPathTypes: {
            ref: {
                type: 'Ref',
                to: CUSTOMER
            },
            ref2: {
                type: 'Ref',
                to: CUSTOMER
            }
        },
        numberFullPaths: [],
        refFullPaths: ['ref', 'ref2'],
        dateFullPaths: [],
        objectIdFullPaths: [],
        booleanFullPaths: [],
        stringFullPaths: [],
    }

    const connect = (callback) => {
        //connect to mongoose and create model
        const MONGODB_CONNECTION: string = "mongodb://localhost:27017/test_mongoose_api_ui_simple";
        connection = mongoose.createConnection(MONGODB_CONNECTION);
        EmptyModel = connection.model<IEmptyModel>(EMPTY_MODEL, emptySchema)
        Customer = connection.model<ICustomerModel>(CUSTOMER, customerSchema);
        Provider = connection.model<IProviderModel>(PROVIDER, providerSchema);
        MultiProvider = connection.model<IMultiProviderModel>(MULTIPROVIDER, multiProviderSchema);
        Customer.find(callback)
    }
    before((done) => {
        //use q promises
        global.Promise = require("q").Promise;

        //use q library for mongoose promise
        mongoose.Promise = global.Promise;

        connect((err) => {
            if (err) return done(err)
            let chai = require("chai");
            chai.should();
            //require chai and use should() assertions
            Customer.insertMany(customerData, (error, customerDocs) => {
                if (error) return done(error)
                customerData = customerDocs
                Provider.insertMany(customerDocs.map((el: ICustomerModel) => ({ ref: el._id, name: 'Alice' })), (error, docs) => {
                    done(error)
                })
            })
        })
    })
    after(function (done) {
        this.timeout(10000)
        connection.dropDatabase((err) => {
            if (err) return done(err)
            connection.close().then(() => done()).catch(done)
        })
    })

    function getModels() {
        const models = {
            [CUSTOMER]: {
                name: CUSTOMER,
                route: '',
                paths: Object.keys(CustomerCtx.fullPathTypes).map(name => ({
                    name,
                    type: CustomerCtx[name],
                    required: false
                })),
                label: 'name',
                model: Customer
            },
            [PROVIDER]: {
                name: PROVIDER,
                route: '',
                paths: Object.keys(ProviderCtx.fullPathTypes).map(name => ({
                    name,
                    type: ProviderCtx[name],
                    required: false
                })),
                label: 'name',
                model: Provider
            },
            [MULTIPROVIDER]: {
                name: MULTIPROVIDER,
                route: '',
                paths: Object.keys(MultiProviderCtx.fullPathTypes).map(name => ({
                    name,
                    type: MultiProviderCtx[name],
                    required: false
                })),
                label: 'name',
                model: MultiProvider
            },
            [EMPTY_MODEL]: {
                name: EMPTY_MODEL,
                route: '',
                paths: [],
                label: '',
                model: EmptyModel
            }
        }
        return models
    }

    function createSimpleTest(title, info: 'Customer' | 'Provider' | 'Empty', query, prevFilter?: any) {
        it(title, (done) => {
            const collection = info === 'Customer' ? Customer : EmptyModel
            const ctx = info === 'Customer' ? CustomerCtx : info === 'Provider' ? ProviderCtx : EmptyCtx
            getQuery(false, {}, collection, ctx, query, prevFilter ? prevFilter : null, (err, cursor) => {
                if (err) return done(err)
                cursor.should.exist;
                cursor.find((err, docs) => {
                    if (err) return done(err)
                    docs.should.exist;
                    let dataset = customerData
                    if (info === 'Empty') dataset = []
                    const results = dataset.filter(el => {
                        let equal = true
                        Object.keys(query).forEach(key => {
                            if (equal) {
                                if (!el[key]) {
                                    equal = false
                                } else {
                                    var map = (el) => el.toString()
                                    if (key === 'date') {
                                        map = el => JSON.stringify(el)
                                    }

                                    if (Array.isArray(query[key])) {
                                        equal = query[key].filter(subel => map(subel) === map(el[key])).length > 0
                                    } else {
                                        equal = (map(el[key]) === map(query[key]))
                                    }
                                }
                            }
                        })
                        return equal
                    })
                    docs.length.should.equal(results.length)
                    docs.forEach((doc, key) => {
                        doc._id.toString().should.equal(results[key]._id.toString())
                    })
                    done()
                })
            })
        })
    }
    function createAnyTest(title, info: 'Customer', value) {
        it(title, (done) => {
            const collection = info === 'Customer' ? Customer : Provider
            const ctx = info === 'Customer' ? CustomerCtx : ProviderCtx
            getQuery(false, {}, collection, ctx, { $any: value }, null, (err, cursor) => {
                if (err) return done(err)
                cursor.should.exist;
                cursor.find((err, docs) => {
                    if (err) return done(err)
                    docs.should.exist;
                    const results = customerData.filter(el => {
                        const elJson = JSON.parse(JSON.stringify(el))
                        const paths = Object.keys(elJson).filter(key => Array.isArray(value) ? value.indexOf(key) >= 0 : key === value)
                        if (paths.length > 0) {
                            let res = false
                            paths.forEach(path => {
                                if (elJson[path] === true)
                                    res = true
                            })
                            if (res) return true
                        }
                        return Object.keys(ctx.fullPathTypes).filter(key => {
                            if (!el[key]) {
                                return false
                            } else {
                                var map = (el) => el.toString()
                                if (key === 'number' || key === 'boolean') {
                                    map = el => JSON.stringify(el)
                                }
                                if (key === 'string')
                                    return map(el[key]).indexOf(value) >= 0
                                if (Array.isArray(value)) {
                                    return value.some(v => v === map(el[key]))
                                }
                                return map(el[key]) === value
                            }
                        }).length > 0
                    })
                    docs.length.should.equal(results.length)
                    docs.forEach((doc, key) => {
                        doc._id.toString().should.equal(results[key]._id.toString())
                    })
                    done()
                })
            })
        })
    }
    function createAnyAndFilterTest(title, info: 'Customer', any: string, query) {
        it(title, (done) => {
            const collection = info === 'Customer' ? Customer : Provider
            const ctx = info === 'Customer' ? CustomerCtx : ProviderCtx
            getQuery(false, {}, collection, ctx, { $any: any, ...query }, null, (err, cursor) => {
                if (err) return done(err)
                cursor.should.exist;
                cursor.find((err, docs) => {
                    if (err) return done(err)
                    docs.should.exist;
                    const results = customerData.filter(el => {
                        if (Object.keys(ctx.fullPathTypes).filter(key => {
                            if (!el[key]) {
                                return false
                            } else {
                                var map = (el) => el.toString()
                                if (key === 'number' || key === 'boolean') {
                                    map = el => JSON.stringify(el)
                                }
                                if (key === 'string')
                                    return map(el[key]).indexOf(any) >= 0
                                if (Array.isArray(any)) {
                                    return any.some(v => v === map(el[key]))
                                }
                                return map(el[key]) === any
                            }
                        }).length > 0) return true
                        let equal = true
                        Object.keys(query).forEach(key => {
                            if (equal) {
                                if (!el[key]) {
                                    equal = false
                                } else {
                                    var map = (el) => el.toString()
                                    if (key === 'date') {
                                        map = el => JSON.stringify(el)
                                    }

                                    if (Array.isArray(query[key])) {
                                        equal = query[key].filter(subel => map(subel) === map(el[key])).length > 0
                                    } else {
                                        equal = (map(el[key]) === map(query[key]))
                                    }
                                }
                            }
                        })
                        return equal
                    })
                    docs.length.should.equal(results.length)
                    docs.forEach((doc, key) => {
                        doc._id.toString().should.equal(results[key]._id.toString())
                    })
                    done()
                })
            })
        })
    }
    function createRefTest(title, info: 'Provider', ref) {
        it(title, (done) => {
            const collection = Provider
            const ctx = ProviderCtx
            getQuery(false, getModels(), collection, ctx, { ref }, null, (err, cursor) => {
                if (err) return done(err)
                cursor.should.exist;
                cursor.find((err, docs) => {
                    if (err) return done(err)
                    const results = customerData.filter(el => {
                        if (Array.isArray(ref))
                            return ref.indexOf(el.name) >= 0
                        return el.name === ref
                    })
                    docs.length.should.equal(results.length)
                    docs.forEach((doc, key) => {
                        doc.ref.toString().should.equal(results[key]._id.toString())
                    })
                    done()
                })
            })
        })
    }
    function createAnyRefTest(title, info: 'Provider', ref) {
        it(title, (done) => {
            const collection = Provider
            const ctx = ProviderCtx
            getQuery(false, getModels(), collection, ctx, { $any: ref }, null, (err, cursor) => {
                if (err) return done(err)
                cursor.should.exist;
                cursor.find((err, docs) => {
                    if (err) return done(err)
                    if (ref === 'Alice' || JSON.stringify(ref) === '[]') {
                        docs.length.should.equal(3)
                        done()
                    } else {
                        const results = customerData.filter(el => {
                            if (Array.isArray(ref))
                                return ref.indexOf(el.name) >= 0
                            return el.name === ref
                        })
                        docs.length.should.equal(results.length)
                        docs.forEach((doc, key) => {
                            doc.ref.toString().should.equal(results[key]._id.toString())
                        })
                        done()
                    }
                })
            })
        })
    }
    createSimpleTest('find by string', 'Customer', { name: 'hector' })
    createSimpleTest('find by all documents', 'Customer', {})
    createSimpleTest('find in document without fields', 'Empty', { $any: 'hector' })
    createSimpleTest('find by string', 'Customer', { name: 'hector' }, { name: 'hector' })
    createSimpleTest('find by number', 'Customer', { number: '1' })
    createSimpleTest('find by number', 'Customer', { name: ['hector', '1'] })
    createSimpleTest('find by boolean', 'Customer', { boolean: 'true' })
    createSimpleTest('find by date', 'Customer', { date: JSON.stringify(date).slice(1, -1) })
    createSimpleTest('find by object id', 'Customer', { objectid: JSON.parse(JSON.stringify(objid)) })
    createSimpleTest('find by array string', 'Customer', { name: ['hector', 'jose'] })
    createSimpleTest('find by array number', 'Customer', { number: ['1', '3'] })
    createSimpleTest('find by array boolean', 'Customer', { boolean: ['true'] })
    createSimpleTest('find by array date', 'Customer', { date: [JSON.stringify(date).slice(1, -1)] })
    createSimpleTest('find by array object id', 'Customer', { objectid: [JSON.parse(JSON.stringify(objid))] })
    createAnyTest('find by any string', 'Customer', 'hector')
    createAnyTest('find by any number', 'Customer', '1')
    createAnyTest('find by any number array', 'Customer', ['1'])
    createAnyTest('find by any long number', 'Customer', '54321')
    createAnyTest('find by any boolean', 'Customer', 'true')
    createAnyTest('find by any boolean array', 'Customer', ['true'])
    createAnyTest('find by any boolean with name', 'Customer', 'boolean')
    createAnyTest('find by any boolean with name', 'Customer', ['boolean', 'boolean2'])
    createAnyTest('find by any date', 'Customer', date.getFullYear().toString())
    createAnyTest('find by any objectid', 'Customer', JSON.parse(JSON.stringify(objid)))
    createAnyTest('find by any objectid array', 'Customer', [JSON.parse(JSON.stringify(objid)), 'some error'])
    createRefTest('find by ref', 'Provider', 'jose')
    createRefTest('find by ref', 'Provider', 'hector')
    createAnyRefTest('find by any ref empty array', 'Provider', [])
    createAnyRefTest('find by any ref', 'Provider', 'hector')
    createAnyRefTest('find by any ref alice', 'Provider', 'Alice')
    createRefTest('find by array ref', 'Provider', ['hector'])
    it('Find by $any with prevFilter', (done) => {
        const query = {
            name: 'jose'
        }
        getQuery(false, getModels(), Customer, CustomerCtx, query, { name: 'hector' }, (err, docs) => {
            if (err) return done(err)
            docs.find((err, res) => {
                if (err) return done(err)
                res.length.should.equal(0)
                getQuery(false, getModels(), Customer, CustomerCtx, query, { name: 'jose' }, (err, docs) => {
                    if (err) return done(err)
                    docs.find((err, res) => {
                        if (err) return done(err)
                        res.length.should.equal(1)
                        done()
                    })
                })
            })
        })
    })
    it('Find by multi refs', (done) => {
        const query = {
            ref: 'hector',
            ref2: 'hector'
        }
        getQuery(false, getModels(), MultiProvider, MultiProviderCtx, query, { name: 'hector' }, (err, docs) => {
            if (err) return done(err)
            done()
        })
    })
    it('Find by type not contemplated not in schema', (done) => {
        const query = {
            $any2: '1'
        }
        getQuery(false, {}, Provider, ProviderCtx, query, null, (err, docs) => {
            if (err) return done(null)
            done('this must be unreachable...')
        })
    })
    createAnyAndFilterTest('find by complex query', 'Customer', '1', { name: 'hector' })
})

