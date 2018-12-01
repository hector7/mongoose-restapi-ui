import { suite, test } from "mocha-typescript";
import getQuery, { CtxType } from '../src/models/query'
import '../src/defintions/model'
import mongoose = require("mongoose");
import { Model, Schema, Document, Types } from 'mongoose'


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
    ref: Types.ObjectId
}

const customerSchema = new Schema({
    name: String,
    number: Number,
    boolean: Boolean,
    date: Date,
    objectid: Schema.Types.ObjectId
})

const providerSchema = new Schema({
    ref: { type: Schema.Types.ObjectId, ref: CUSTOMER }
})

type ICustomerModel = ICustomer & Document
type IProviderModel = IProvider & Document

@suite
class SimpleQueryTest {
    private timeout: (number) => void
    public static date: Date = new Date()
    public static objid = new Types.ObjectId('12a456789012345678901234')
    //store test data
    public static customerData: ICustomer[] = [{
        name: 'hector',
        number: 1,
        boolean: true,
        objectid: SimpleQueryTest.objid
    }, {
        name: 'jose',
        number: 2,
        boolean: true
    }, {
        name: 'Alice',
        number: 1,
        date: SimpleQueryTest.date
    }]

    //the Customer model
    public static Customer: mongoose.Model<ICustomerModel>;
    //the Provider model
    public static Provider: mongoose.Model<IProviderModel>;

    public static connection: mongoose.Connection
    public static CustomerCtx: CtxType = {
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
        isNumber: (field) => {
            return field === 'number'
        },
        numberFullPaths: ['number'],
        refFullPaths: [],
        stringFullPaths: ['name'],
        dateFullPaths: ['date'],
        booleanFullPaths: ['boolean'],
        objectIdFullPaths: ['objectid'],
        transformationMap: {
            number: 'number1',
            boolean: 'boolean1',
            date: 'date1',
            objectid: 'objectid1'
        },
        convertStep: {
            $addFields: {
                number1: {
                    $toString: '$number'
                },
                date1: {
                    $toString: '$date'
                },
                objectid1: {
                    $toString: '$objectid'
                },
                boolean1: {
                    $toString: '$boolean'
                }
            }
        }
    }
    public static ProviderCtx: CtxType = {
        fullPathTypes: {
            ref: {
                type: 'Ref',
                to: CUSTOMER
            }
        },
        isNumber: (field) => {
            return false
        },
        numberFullPaths: [],
        refFullPaths: ['ref'],
        dateFullPaths: [],
        objectIdFullPaths: [],
        booleanFullPaths: [],
        stringFullPaths: [],
        transformationMap: {},
        convertStep: {
            $addFields: {
            }
        }
    }

    public static connect(callback) {
        //connect to mongoose and create model
        const MONGODB_CONNECTION: string = "mongodb://localhost:27017/test_mongoose_api_ui_simple";
        SimpleQueryTest.connection = mongoose.createConnection(MONGODB_CONNECTION);
        SimpleQueryTest.Customer = SimpleQueryTest.connection.model<ICustomerModel>(CUSTOMER, customerSchema);
        SimpleQueryTest.Provider = SimpleQueryTest.connection.model<IProviderModel>(PROVIDER, providerSchema);
        SimpleQueryTest.Customer.find(callback)
    }
    public static before(done) {
        //use q promises
        global.Promise = require("q").Promise;

        //use q library for mongoose promise
        mongoose.Promise = global.Promise;

        SimpleQueryTest.connect((err) => {
            if (err) return done(err)
            let chai = require("chai");
            chai.should();
            //require chai and use should() assertions
            SimpleQueryTest.Customer.insertMany(SimpleQueryTest.customerData, (error, customerDocs) => {
                if (error) return done(error)
                SimpleQueryTest.Provider.insertMany(customerDocs.map((el: ICustomerModel) => ({ ref: el._id })), (error) => {
                    done(error)
                })
            })
        })
    }
    public static after(done) {
        SimpleQueryTest.Customer.remove((error) => {
            if (error) return done(error)
            SimpleQueryTest.Provider.remove((error) => {
                if (error) return done(error)
                SimpleQueryTest.connection.close((error) => {
                    done(error)
                })
            })
        })
    }
    @test("Find by string")
    public findByString(done) {
        const query = {
            name: 'hector'
        }
        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(1);
            docs[0].name.should.equal('hector');
            done()
        })
    }
    @test("Find by number")
    public findByNumber(done) {
        const query = {
            number: '1'
        }
        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(2);
            docs[0].name.should.equal('hector');
            docs[1].name.should.equal('Alice');
            done()
        })
    }
    @test("Find by boolean")
    public findByBool(done) {
        const query = {
            boolean: 'true'
        }
        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(2);
            docs[0].name.should.equal('hector');
            docs[1].name.should.equal('jose');
            done()
        })
    }
    @test("Find by date")
    public findByDate(done) {
        const query = {
            date: JSON.stringify(SimpleQueryTest.date).slice(1, -1)
        }
        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(1);
            docs[0].name.should.equal('Alice');
            done()
        })
    }
    @test("Find by object id")
    public findByObjectId(done) {
        const query = {
            objectid: JSON.parse(JSON.stringify(SimpleQueryTest.objid))
        }

        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(1);
            docs[0].name.should.equal('hector');
            done()
        })
    }

    @test("Find by ArrayString")
    public findByArrayString(done) {
        const query = {
            name: ['hector', 'jose']
        }
        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(2);
            docs[0].name.should.equal('hector');
            docs[1].name.should.equal('jose');
            done()
        })
    }
    @test("Find by ArrayNumber")
    public findByArrayNumber(done) {
        const query = {
            number: ['1', '3']
        }
        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(2);
            docs[0].name.should.equal('hector');
            docs[1].name.should.equal('Alice');
            done()
        })
    }
    @test("Find by Array boolean")
    public findByArrayBool(done) {
        const query = {
            boolean: ['true']
        }
        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(2);
            docs[0].name.should.equal('hector');
            docs[1].name.should.equal('jose');
            done()
        })
    }
    @test("Find by Array date")
    public findByArrayDate(done) {
        const query = {
            date: [JSON.stringify(SimpleQueryTest.date).slice(1, -1)]
        }
        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(1);
            docs[0].name.should.equal('Alice');
            done()
        })
    }
    @test("Find by Array object id")
    public findByArrayObjectId(done) {
        const query = {
            objectid: [JSON.parse(JSON.stringify(SimpleQueryTest.objid))]
        }

        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(1);
            docs[0].name.should.equal('hector');
            done()
        })
    }
    @test("Find by Array ref")
    public findByArrayRef(done) {
        const query = {
            ref: 'hector'
        }
        const models = {
            [CUSTOMER]: {
                name: CUSTOMER,
                route: '',
                paths: Object.keys(SimpleQueryTest.CustomerCtx.fullPathTypes).map(name => ({
                    name,
                    type: SimpleQueryTest.CustomerCtx[name],
                    required: false
                })),
                label: 'name',
                model: SimpleQueryTest.Customer
            },
            [PROVIDER]: {
                name: PROVIDER,
                route: '',
                paths: Object.keys(SimpleQueryTest.ProviderCtx.fullPathTypes).map(name => ({
                    name,
                    type: SimpleQueryTest.ProviderCtx[name],
                    required: false
                })),
                label: 'name',
                model: SimpleQueryTest.Customer
            }
        }
        getQuery(models, SimpleQueryTest.Provider, SimpleQueryTest.ProviderCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(1);
            SimpleQueryTest.Customer.findById(docs[0].ref, (err, res) => {
                if (err) return done(err)
                res.name.should.equal('hector')
                done()
            })
        })
    }
    @test("Find by any string")
    public findByAnyString(done) {
        const query = {
            $any: 'hector'
        }
        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(1);
            docs[0].name.should.equal('hector');
            done()
        })
    }
    @test("Find by any array string")
    public findByAnyArrayString(done) {
        const query = {
            $any: ['hector', 'jose']
        }
        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(null)
            return done('must be unreachable this line')
            docs.should.exist;
            docs.length.should.equal(2);
            docs[0].name.should.equal('hector');
            docs[1].name.should.equal('jose');
            done()
        })
    }
    @test("Find by any number")
    public findByAnyNumber(done) {
        const query = {
            $any: '1'
        }
        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(2);
            docs[0].name.should.equal('hector');
            docs[1].name.should.equal('Alice');
            done()
        })
    }
    @test("Find by any - boolean")
    public findByAnyBool(done) {
        const query = {
            $any: 'true'
        }
        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(2);
            docs[0].name.should.equal('hector');
            docs[1].name.should.equal('jose');
            done()
        })
    }
    @test("Find by any - date")
    public findByAnyDate(done) {
        const query = {
            $any: SimpleQueryTest.date.getFullYear().toString()
        }
        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(1);
            docs[0].name.should.equal('Alice');
            done()
        })
    }
    @test("Find by any object id")
    public findByObjectIdAny(done) {
        const query = {
            $any: JSON.parse(JSON.stringify(SimpleQueryTest.objid))
        }

        getQuery({}, SimpleQueryTest.Customer, SimpleQueryTest.CustomerCtx, query, (err, docs) => {
            if (err) return done(err)
            docs.should.exist;
            docs.length.should.equal(1);
            docs[0].name.should.equal('hector');
            done()
        })
    }
    @test("Find by ref and close connection")
    public findByRefWillFail(done) {
        const query = {
            ref: 'hector'
        }
        const models = {
            [CUSTOMER]: {
                name: CUSTOMER,
                route: '',
                paths: Object.keys(SimpleQueryTest.CustomerCtx.fullPathTypes).map(name => ({
                    name,
                    type: SimpleQueryTest.CustomerCtx[name],
                    required: false
                })),
                label: 'name',
                model: SimpleQueryTest.Customer
            },
            [PROVIDER]: {
                name: PROVIDER,
                route: '',
                paths: Object.keys(SimpleQueryTest.ProviderCtx.fullPathTypes).map(name => ({
                    name,
                    type: SimpleQueryTest.ProviderCtx[name],
                    required: false
                })),
                label: 'name',
                model: SimpleQueryTest.Customer
            }
        }
        const callback = (finalError) => {
            SimpleQueryTest.connect((err) => {
                if (err) return done(err)
                done(finalError)
            })
        }
        getQuery(models, SimpleQueryTest.Provider, SimpleQueryTest.ProviderCtx, query, (err, docs) => {
            if (err) return callback(null)
            callback('this must be unreachable...')
        })
        SimpleQueryTest.connection.close((err) => {
            if (err) return callback(err)
        })
    }
    @test("Find by $any string and close connection")
    public findByAnyWillFail(done) {
        const query = {
            $any: 'hector'
        }
        const models = {
            [CUSTOMER]: {
                name: CUSTOMER,
                route: '',
                paths: Object.keys(SimpleQueryTest.CustomerCtx.fullPathTypes).map(name => ({
                    name,
                    type: SimpleQueryTest.CustomerCtx[name],
                    required: false
                })),
                label: 'name',
                model: SimpleQueryTest.Customer
            },
            [PROVIDER]: {
                name: PROVIDER,
                route: '',
                paths: Object.keys(SimpleQueryTest.ProviderCtx.fullPathTypes).map(name => ({
                    name,
                    type: SimpleQueryTest.ProviderCtx[name],
                    required: false
                })),
                label: 'name',
                model: SimpleQueryTest.Customer
            }
        }
        const callback = (finalError) => {
            SimpleQueryTest.connect((err) => {
                if (err) return done(err)
                done(finalError)
            })
        }
        getQuery(models, SimpleQueryTest.Provider, SimpleQueryTest.ProviderCtx, query, (err, docs) => {
            if (err) return callback(null)
            callback('this must be unreachable...')
        })
        SimpleQueryTest.connection.close((err) => {
            if (err) return callback(err)
        })
    }
    @test("Find by $any number and close connection")
    public findByAnyNumberWillFail(done) {
        const query = {
            $any: '1'
        }
        const models = {
            [CUSTOMER]: {
                name: CUSTOMER,
                route: '',
                paths: Object.keys(SimpleQueryTest.CustomerCtx.fullPathTypes).map(name => ({
                    name,
                    type: SimpleQueryTest.CustomerCtx[name],
                    required: false
                })),
                label: 'name',
                model: SimpleQueryTest.Customer
            },
            [PROVIDER]: {
                name: PROVIDER,
                route: '',
                paths: Object.keys(SimpleQueryTest.ProviderCtx.fullPathTypes).map(name => ({
                    name,
                    type: SimpleQueryTest.ProviderCtx[name],
                    required: false
                })),
                label: 'name',
                model: SimpleQueryTest.Customer
            }
        }
        const callback = (finalError) => {
            SimpleQueryTest.connect((err) => {
                if (err) return done(err)
                done(finalError)
            })
        }
        getQuery(models, SimpleQueryTest.Provider, SimpleQueryTest.ProviderCtx, query, (err, docs) => {
            if (err) return callback(null)
            callback('this must be unreachable...')
        })
        SimpleQueryTest.connection.close((err) => {
            if (err) return callback(err)
        })
    }
    @test("Find by type not contemplated not in schema")
    public findByNotPathWillFail(done) {
        const query = {
            $any2: '1'
        }
        getQuery({}, SimpleQueryTest.Provider, SimpleQueryTest.ProviderCtx, query, (err, docs) => {
            if (err) return done(null)
            done('this must be unreachable...')
        })
    }
}