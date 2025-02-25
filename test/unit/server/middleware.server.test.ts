import express from 'express';
import { mock, spy } from 'sinon'
import request from 'supertest'
import Singleton from '../../../src/server';
// @ts-ignore
import { nullLogger } from '../helpers';

describe('Express Middleware', function () {
  let client
  let client_mock
  const error = new Error('Badgers!')

  beforeEach(function () {
    client = Singleton.factory({
      logger: nullLogger(),
      environment: null
    })
    client_mock = mock(client)
  })

  // eslint-disable-next-line jest/expect-expect
  it('is sane', function () {
    const app = express()

    app.get('/user', function (req, res) {
      res.status(200).json({ name: 'john' })
    })

    client_mock.expects('notify').never()

    return request(app)
      .get('/user')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
  })

  it('reports the error to Honeybadger and calls next error handler', function() {
    const app = express()
    const expected = spy()

    app.use(client.requestHandler)

    app.get('/', function(_req, _res) {
      throw(error)
    })

    app.use(client.errorHandler)

    app.use(function(err, _req, _res, next) {
      expected()
      next(err)
    })

    client_mock.expects('notify').once().withArgs(error)

    return request(app)
      .get('/')
      .expect(500)
      .then(() => {
        client_mock.verify()
        expect(expected.calledOnce).toBeTruthy()
      })
  })

  it('reports async errors to Honeybadger and calls next error handler', function() {
    const app = express()
    const expected = spy()

    app.use(client.requestHandler)

    app.get('/', function(_req, _res) {
      setTimeout(function asyncThrow() {
        throw(error)
      }, 0)
    })

    app.use(client.errorHandler)

    app.use(function(err, _req, _res, next) {
      expected()
      next(err)
    })

    client_mock.expects('notify').once().withArgs(error)

    return request(app)
      .get('/')
      .expect(500)
      .then(() => {
        client_mock.verify()
        expect(expected.calledOnce).toBeTruthy()
      })
  })

  it('does not leak context between requests', function() {
    const app = express()

    app.use(client.requestHandler)

    app.get('/:reqId', (req, res) => {
      const initialContext = client.__store.getStore().context;
      client.setContext({ reqId: req.params.reqId });
      setTimeout(() => {
        res.json({
          initial: initialContext,
          final: client.__store.getStore().context
        });
      }, 1000);
    });

    app.use(client.errorHandler)

    return Promise.all([1, 2].map((i) => {
      return request(app).get(`/${i}`)
        .expect(200)
        .then((response) => {
          const expectedContexts = { initial: {}, final: { reqId: `${i}` } }
          expect(response.body).toStrictEqual(expectedContexts)
        })
    }));
  })
})
