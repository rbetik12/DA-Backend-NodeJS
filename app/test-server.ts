import express = require('express');
import bodyParser = require('body-parser');
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import {User} from './common/models/user.interface';
import {Credentials} from './common/models/credentials.interface';
import { MessageModel } from './common/models/message-model.interface';
import { MongoHelper } from './common/db/mongo.helper';
import { resolve } from 'path';
import { rejects } from 'assert';


const app: express.Application = express();
app.use(bodyParser.json());
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); 
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

const RSA_KEY = fs.readFileSync('key.pem');

const http = require('http').Server(app);
const io = require('socket.io')(http);
const url = "mongodb://localhost:27017/readr";
import * as mongo from 'mongodb';
let x: any;

export async function getUsers(callback: any) {
    await MongoHelper.connect(url);
    return MongoHelper.client.db('readr').collection('users').find({}).toArray((err:any, items: any) =>{
            if (err) {
                express.response.status(500);
                express.response.end();
                console.error('Caught error', err);
            } else {
                callback(items);
            }
        });
}

async function use() {
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('users').find({}).toArray();
    return coll;
}

let users: User[] = [{
    _id: "kek",
    name: 'Vitaliy',
    about: 'Very interestin young man. Love to love and be loved',
    email: 'lol@gmail.com',
    gender: 'M',
    age: 19,
    interests: ['kek'],
    password: '123456'
}];

const documents: any = {};
const messages: MessageModel[] = [];

io.on("connection", async (socket: any) => {
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('messages');
    const mssgs = await coll.find({}).toArray();
    console.table(mssgs);
    console.log("connection");
    let userID: number;
    socket.emit("join", mssgs);
    socket.on("newMessage", (message: MessageModel) => {
        coll.insertOne(message);
        console.log("added message");
        console.table(message);
        messages.push(message);
        io.emit("newMessage", message);
    });

    socket.on("join", (id: number) => {
        const mssgs = coll.find({}).toArray();
        console.table("get messages");
        userID = id;
        socket.emit("join", mssgs);
    });
});

http.listen(5000, '192.168.1.106');


export async function findUser(info: Credentials): Promise<User | null | String> {
    const client = await MongoHelper.connect(url);
    const coll: User[] = await client.db('readr').collection('users').find({}).toArray();
    //console.log(coll);
    for (let user of coll) {
        console.log(user.email, ' ', info.email);
        console.log(user.password, ' ', info.password);
        if (user.email === info.email && user.password === info.password) {
            user._id = user._id.toString();
            return user;
        }
    }
    //return "naker idi";
    return null;
}

export async function register(req: any, res: any) {
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('users');
    const user: User = req.body.userInfo;
    coll.insertOne(user);
    console.table(user);
    users.push(user);

    res.status(200).json({status: 'fine'});
}

export async function editProfile(req: any, res: any){
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('users');
    const user: User = req.body.user;
    let userFromDB = await coll.findOne({_id: user._id});
    console.table(userFromDB);
}

export async function login(req: any, res: any) {
    // let p = false;
    
    const credentials: Credentials = req.body.loginInfo;
    console.table(credentials);
    const h = 2;

    // for (let user of coll) {
    //     console.log(user.email, ' ', credentials.email);
    //     console.log(user.password, ' ', credentials.password);
    //     if (user.email === credentials.email && user.password === credentials.password) {
    //         p = true;
    //     }
    // }
    const foundUser = (await findUser(credentials).then((res) => { return res}))
    if (foundUser) {
        const jwtToken = jwt.sign({email: credentials.email}, RSA_KEY, {
            algorithm: 'RS256',
            expiresIn: '2 hours',
            subject: credentials.email,
        });
        const currentTime = new Date();
        res.status(200).json({
            emailToken: jwtToken,
            expiresIn: currentTime.setTime(currentTime.getTime() + (h*60*60*1000)),
            credentials: foundUser
        });
    }
    else {
        res.status(404).end();
    }
}

app.route('/api/profile').post(editProfile);

app.route('/api/register').post(register);

app.route('/api/login').post(login);

app.listen(4000, '192.168.1.106', async () => {
    console.log("Server launched");
    console.table(users[0]);
    const credentials: Credentials = { email: "belozubov@niuitmo.ru",
password: "123456"}
    const d = await findUser(credentials).then((res) => {return res});
    console.table(d);
    try {
        await MongoHelper.connect(url);
        console.info(`Connected to Mongo!`);
      } catch (err) {
        console.error(`Unable to connect to Mongo!`, err);
      }
})