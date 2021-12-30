import Singleton from "../../../src/server";
// @ts-ignore
import { nullLogger } from "../helpers";
import nock from "nock";
import { spy } from 'sinon'
import { Notice } from "../../../src/core/types";
// eslint-disable-next-line import/no-unresolved
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'

const mockAwsEvent = (obj: Partial<APIGatewayProxyEvent> = {}) => {
    return Object.assign({}, obj) as APIGatewayProxyEvent;
}

const mockAwsContext = (obj: Partial<Context> = {}) => {
    return Object.assign({}, obj) as Context;
}

const mockAwsResult = (obj: Partial<APIGatewayProxyResult> = {}) => {
    return Object.assign({}, obj) as APIGatewayProxyResult;
}

describe('Lambda Handler', function () {
    let client: typeof Singleton;

    beforeEach(function () {
        client = Singleton.factory({
            logger: nullLogger(),
            environment: null
        })
    })

    describe('with arguments', function() {
        const awsEvent = mockAwsEvent({ body: '1' })
        const awsContext = mockAwsContext({ awsRequestId: '2' })
        let handlerFunc

        beforeEach(function() {
            handlerFunc = spy()
            const handler = client.lambdaHandler(handlerFunc)
            return handler(awsEvent, awsContext)
                .then(() => {
                    return new Promise((resolve => {
                        process.nextTick(function () {
                            resolve(true)
                        })
                    }))
                })
        })

        it('calls original handler with arguments', function() {
            expect(handlerFunc.lastCall.args.length).toBe(2)
            expect(handlerFunc.lastCall.args[0]).toBe(awsEvent)
            expect(handlerFunc.lastCall.args[1]).toBe(awsContext)
        })
    })

    describe('async handlers', function() {

        it('calls handler with asynchronous response if no error is thrown', async function () {
            client.configure({
                apiKey: 'testing'
            })

            const handler = client.lambdaHandler(async function(_event, _context) {
                return Promise.resolve(mockAwsResult({body:'works!'}))
            })

            const res = await handler(mockAwsEvent(), mockAwsContext())
            expect(res).toBeDefined()
            expect(res.body).toEqual('works!')
        })

        it('calls handler with synchronous response if no error is thrown', async function () {
            client.configure({
                apiKey: 'testing'
            })

            const handler = client.lambdaHandler(async function(_event, _context) {
                return mockAwsResult({body:'works!'})
            })

            const res = await handler(mockAwsEvent(), mockAwsContext())
            expect(res).toBeDefined()
            expect(res.body).toEqual('works!')
        })

        it('calls handler if notify exits on preconditions', async function () {
            client.configure({
                apiKey: null
            })

            const handler = client.lambdaHandler(async function(_event) {
                throw new Error("Badgers!")
            })

            return expect(handler(mockAwsEvent(), mockAwsContext())).rejects.toEqual(new Error("Badgers!"))
        })

        it('reports errors to Honeybadger', async function() {
            client.configure({
                apiKey: 'testing'
            })

            nock.cleanAll()

            const api = nock("https://api.honeybadger.io")
                .post("/v1/notices/js")
                .reply(201, '{"id":"1a327bf6-e17a-40c1-ad79-404ea1489c7a"}')

            const handler = client.lambdaHandler(async function(_event) {
                throw new Error("Badgers!")
            })

            try {
                await handler(mockAwsEvent(), mockAwsContext())
            }
            catch (e) {
                // eslint-disable-next-line jest/no-conditional-expect
                expect(e).toEqual(new Error("Badgers!"))
            }

            return new Promise<void>(resolve => {
                setTimeout(() => {
                    api.done()
                    resolve()
                }, 50)
            })
        })

        // eslint-disable-next-line jest/expect-expect
        it('reports async errors to Honeybadger', async function() {
            client.configure({
                apiKey: 'testing'
            })

            nock.cleanAll()

            const api = nock("https://api.honeybadger.io")
                .post("/v1/notices/js")
                .reply(201, '{"id":"1a327bf6-e17a-40c1-ad79-404ea1489c7a"}')

            const handler = client.lambdaHandler(async function(_event) {
                return new Promise<APIGatewayProxyResult>((resolve, reject) => {
                    setTimeout(function() {
                        reject(new Error("Badgers!"))
                    }, 0)
                })
            })

            try {
                await handler(mockAwsEvent(), mockAwsContext())
            }
            catch (e) {
                // eslint-disable-next-line jest/no-conditional-expect
                expect(e).toEqual(new Error("Badgers!"))
            }

            return new Promise<void>(resolve => {
                setTimeout(() => {
                    api.done()
                    resolve()
                }, 50)
            })
        })
    })

    describe('non-async handlers', function() {

        beforeEach(function () {
            client.configure({
                apiKey: 'testing'
            })
        })

        it('calls handler if no error is thrown', async function () {
            const handler = client.lambdaHandler(function(_event, _context, callback) {
                callback(null, mockAwsResult({ body: 'works!' }))
            })

            const res = await handler(mockAwsEvent(), mockAwsContext())
            expect(res).toBeDefined()
            expect(res.body).toEqual('works!')
        })

        it('calls handler if notify exits on preconditions', function () {
            client.configure({
                apiKey: null
            })

            const handler = client.lambdaHandler(function(_event, _context, _callback) {
                throw new Error("Badgers!")
            })

            return expect(handler(mockAwsEvent(), mockAwsContext())).rejects.toEqual(new Error("Badgers!"))
        })

        it('reports errors to Honeybadger', async function() {
            nock.cleanAll()

            const api = nock("https://api.honeybadger.io")
                .post("/v1/notices/js")
                .reply(201, '{"id":"1a327bf6-e17a-40c1-ad79-404ea1489c7a"}')

            const handler = client.lambdaHandler(function(_event, _context, _callback) {
                throw new Error("Badgers!")
            })

            try {
                await handler(mockAwsEvent(), mockAwsContext())
            }
            catch (e) {
                // eslint-disable-next-line jest/no-conditional-expect
                expect(e).toEqual(new Error("Badgers!"))
            }

            return new Promise<void>(resolve => {
                setTimeout(() => {
                    api.done()
                    resolve()
                }, 50)
            })
        })

        it('reports async errors to Honeybadger', async function() {
            nock.cleanAll()

            const api = nock("https://api.honeybadger.io")
                .post("/v1/notices/js")
                .reply(201, '{"id":"1a327bf6-e17a-40c1-ad79-404ea1489c7a"}')

            const handler = client.lambdaHandler(function(_event, _context, callback) {
                setTimeout(function() {
                    callback(new Error("Badgers!"))
                }, 0)
            })

            try {
                await handler(mockAwsEvent(), mockAwsContext())
            }
            catch (e) {
                // eslint-disable-next-line jest/no-conditional-expect
                expect(e).toEqual(new Error("Badgers!"))
            }

            return new Promise<void>(resolve => {
                setTimeout(() => {
                    api.done()
                    resolve()
                }, 50)
            })
        })

        it('calls beforeNotify and afterNotify handlers', async function () {
            nock.cleanAll()

            const api = nock("https://api.honeybadger.io")
                .post("/v1/notices/js")
                .reply(201, '{"id":"1a327bf6-e17a-40c1-ad79-404ea1489c7a"}')

            const handler = client.lambdaHandler(function(_event, _context, callback) {
                setTimeout(function() {
                    callback(new Error("Badgers!"))
                }, 0)
            })

            client.beforeNotify(function (notice: Notice) {
                notice.context = Object.assign(notice.context, { foo: 'bar' })
            })

            let afterNotifyCalled = false;
            client.afterNotify(function (err: Error | undefined, notice: Notice) {
                expect(notice.context).toEqual({ foo: 'bar' })
                afterNotifyCalled = true;
            })

            try {
                await handler(mockAwsEvent(), mockAwsContext())
            }
            catch (e) {
                // eslint-disable-next-line jest/no-conditional-expect
                expect(e).toEqual(new Error("Badgers!"))
            }

            return new Promise<void>(resolve => {
                setTimeout(() => {
                    api.done()
                    expect(afterNotifyCalled).toBeTruthy()
                    resolve()
                }, 50)
            })
        })
    })
})