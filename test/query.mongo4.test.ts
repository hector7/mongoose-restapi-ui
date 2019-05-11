import "mocha-typescript";
import getQuery, { CtxType, Query } from '../src/models/query'
import mongoose = require("mongoose");
import { Schema, Document, Types } from 'mongoose'


const CUSTOMER = 'Customer'
const PROVIDER = 'Provider'

type ICustomer = {

    name?: string,
    number?: number,
    boolean?: boolean,
    date?: Date,
    objectid?: Types.ObjectId,
}
type IProvider = {
    ref: Types.ObjectId,
    name: String
}

const customerSchema = new Schema({
    name: String,
    number: Number,
    boolean: Boolean,
    date: Date,
    objectid: Schema.Types.ObjectId
})

const providerSchema = new Schema({
    ref: { type: Schema.Types.ObjectId, ref: CUSTOMER },
    name: String
})

type ICustomerModel = ICustomer & Document
type IProviderModel = IProvider & Document

describe('SimpleQueryTest with mongo4', () => {
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
        date: date
    }]

    //the Customer model
    var Customer: mongoose.Model<ICustomerModel>;
    //the Provider model
    var Provider: mongoose.Model<IProviderModel>;

    var connection: mongoose.Connection
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
        booleanFullPaths: ['boolean'],
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

    const connect = (callback) => {
        //connect to mongoose and create model
        const MONGODB_CONNECTION: string = "mongodb://localhost:27017/test_mongoose_api_ui_simple";
        connection = mongoose.createConnection(MONGODB_CONNECTION);
        Customer = connection.model<ICustomerModel>(CUSTOMER, customerSchema);
        Provider = connection.model<IProviderModel>(PROVIDER, providerSchema);
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
                model: Customer
            }
        }
        return models
    }

    function createSimpleTest(title, info: 'Customer' | 'Provider', query, prevFilter?: any) {
        it(title, (done) => {
            const collection = info === 'Customer' ? Customer : Provider
            const ctx = info === 'Customer' ? CustomerCtx : ProviderCtx
            getQuery(true, {}, collection, ctx, query, prevFilter ? prevFilter : null, (err, cursor) => {
                if (err) return done(err)
                cursor.should.exist;
                cursor.find((err, docs) => {
                    if (err) return done(err)
                    docs.should.exist;
                    const results = customerData.filter(el => {
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
            getQuery(true, {}, collection, ctx, { $any: value }, null, (err, cursor) => {
                if (err) return done(err)
                cursor.should.exist;
                cursor.find((err, docs) => {
                    if (err) return done(err)
                    docs.should.exist;
                    const results = customerData.filter(el => {
                        return Object.keys(ctx.fullPathTypes).filter(key => {
                            if (!el[key]) {
                                return false
                            } else {
                                var map = (el) => el.toString()
                                if (key === 'date') {
                                    map = el => JSON.stringify(el)
                                }
                                return map(el[key]).indexOf(value) >= 0
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
    function createRefTest(title, info: 'Provider', ref) {
        it(title, (done) => {
            const collection = Provider
            const ctx = ProviderCtx
            getQuery(true, getModels(), collection, ctx, { ref }, null, (err, cursor) => {
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
            getQuery(true, getModels(), collection, ctx, { $any: ref }, null, (err, cursor) => {
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
    createAnyTest('find by any long number', 'Customer', '54321')
    createAnyTest('find by any boolean', 'Customer', 'true')
    createAnyTest('find by any date', 'Customer', date.getFullYear().toString())
    createAnyTest('find by any objectid', 'Customer', JSON.parse(JSON.stringify(objid)))
    createRefTest('find by ref', 'Provider', 'jose')
    createRefTest('find by ref', 'Provider', 'hector')
    createAnyRefTest('find by any ref empty array', 'Provider', [])
    createAnyRefTest('find by any ref', 'Provider', 'hector')
    createAnyRefTest('find by any ref alice', 'Provider', 'Alice')
    createRefTest('find by array ref', 'Provider', ['hector'])
    it('Find by ref with error', (done) => {
        const query = {
            ref: 'hector'
        }
        const fakeProvider = mongoose.model(PROVIDER + 'FAKE', providerSchema)
        fakeProvider.aggregate = (aggregate: any[], callback?: (err: any, res?: Document[]) => void) => {
            callback('some error')
            return null
        }
        getQuery(true, getModels(), fakeProvider, ProviderCtx, query, null, (err, docs) => {
            err.should.be.equal('some error')
            if (err) return done(null)
            done('this line must be unreachable')
        })
    })
    it('Find by $any string with error', (done) => {
        const query = {
            $any: 'hector'
        }
        const fakeCustomer = mongoose.model(CUSTOMER + 'FAKE', customerSchema)
        fakeCustomer.aggregate = (aggregate: any[], callback?: (err: any, res?: Document[]) => void) => {
            callback('some error')
            return null
        }
        getQuery(true, {}, fakeCustomer, CustomerCtx, query, null, (err, docs) => {
            err.should.be.equal('some error')
            if (err) return done(null)
            done('this line must be unreachable')
        })
    })
    it('Find by $any number and close connection', (done) => {
        const query = {
            $any: '1'
        }

        const fakeCustomer = mongoose.model(CUSTOMER + 'FAKE', customerSchema)
        const originalAggregate = fakeCustomer.aggregate
        fakeCustomer.aggregate = (...args: any): any => {
            const result = originalAggregate(...args)
            result.exec = (callback) => {
                callback('some error', [])
            }
            return result
        }
        getQuery(true, {}, fakeCustomer, CustomerCtx, query, null, (err, docs) => {
            err.should.be.equal('some error')
            if (err) return done(null)
            done('this line must be unreachable')
        })
    })
    it('Find by any array string', (done) => {
        const query = {
            $any: ['hector', 'jose']
        }
        getQuery(true, {}, Customer, CustomerCtx, query, null, (err, docs) => {
            if (err) return done(err)
            return done()
        })
    })
    it('Find by type not contemplated not in schema', (done) => {
        const query = {
            $any2: '1'
        }
        getQuery(true, {}, Provider, ProviderCtx, query, null, (err, docs) => {
            if (err) return done(null)
            done('this must be unreachable...')
        })
    })
})

