import express = require('express');
import bodyParser = require('body-parser');
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import { User } from './common/models/user.interface';
import { Credentials } from './common/models/credentials.interface';
import { MessageModel } from './common/models/message-model.interface';
import { MongoHelper } from './common/db/mongo.helper';
import distance from './common/utils/find_distance';
import * as mongo from 'mongodb';
import { Like } from './common/models/like.interface';

const app: express.Application = express();

app.use(bodyParser.json());
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

const http = require('http').Server(app);
const io = require('socket.io')(http);

const RSA_KEY = fs.readFileSync('key.pem');
const url = "mongodb://localhost:27017/readr";
const IP = "192.168.1.100"; // Don't touch that mazafucka, just change it to localhost or don't, better not to touch that. I fucking swear that I'll kill you if you change that

export async function getUsers(callback: any) {
    await MongoHelper.connect(url);
    return MongoHelper.client.db('readr').collection('users').find({}).toArray((err: any, items: any) => {
        if (err) {
            express.response.status(500);
            express.response.end();
            console.error('Caught error', err);
        } else {
            callback(items);
        }
    });
}

function getCoefficient(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const dist = distance(lat1, lon1, lat2, lon2);
    console.log(dist);
    if (0 <= dist && dist <= 200) {
        return 6;
    } else if (201 <= dist && dist <= 2000) {
        return 5;
    } else if (2001 <= dist && dist <= 10000) {
        return 4;
    } else {
        return 1;
    }
}

let users: User[] = [];

io.on("connection", async (socket: any) => {
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('messages');
    const mssgs = await coll.find({}).toArray();
    console.log("new user joined the chat");
    let N = 20;


    socket.on("newMessage", async (message: MessageModel) => {
        await coll.insertOne(message);
        const messagesAmount = await coll.count() - N;
        let toSkip = messagesAmount < 0 ? 0 : messagesAmount;
        console.log("New message from client");
        console.table(message);

        N += 1;
        let mssgs: MessageModel[] = await coll.find({}).skip(toSkip).toArray();

        mssgs.map((msg) => {
            msg.coefficient = getCoefficient(message.latitude, message.longitude, msg.latitude, msg.longitude);
            return msg;
        });
        socket.emit("join", mssgs);
        io.emit("join", mssgs);
    });

    socket.on("join", async (id: number) => {
        const messagesAmount = await coll.count() - N;
        let toSkip = messagesAmount < 0 ? 0 : messagesAmount;
        const mssgs = await coll.find({}).skip(toSkip).toArray();
        N += 1;
        console.table("Sending all messages to client");
        socket.emit("join", mssgs);
    });
});

http.listen(5000, IP);


export async function findUser(info: Credentials): Promise<User | null | String> {
    const client = await MongoHelper.connect(url);
    const coll: User[] = await client.db('readr').collection('users').find({}).toArray();
    for (let user of coll) {
        if (user.email === info.email && user.password === info.password) {
            user._id = user._id.toString();
            return user;
        }
    }
    return null;
}

export async function register(req: any, res: any) {
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('users');
    const user: User = req.body.userInfo;
    coll.insertOne(user);
    console.table(user);
    users.push(user);

    res.status(200).json({ status: 'fine' });
}

export async function editProfile(req: any, res: any) {
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('users');
    const user: User = req.body.user;
    const id = new mongo.ObjectID(user._id);
    const userFromDB = await coll.findOneAndUpdate({ _id: id }, { $set:{"about": user.about, "interests": user.interests}});
    console.table(userFromDB);

    res.status(200);
}

export async function like(req: any, res: any) {
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('users');
    const reqlike: Like = req.body;
    const userId = new mongo.ObjectID(reqlike.userWhoGetLiked);
    let userFromDB: User = await coll.findOne({ _id: userId });
    console.log(reqlike);
    let likes: string[] = userFromDB.likes || [];
    let idExist = false;
    for (let user_id in likes) {
        if (user_id === reqlike.userId) {
            idExist = true;
        }
    }
    if (!idExist) {
        likes.push(reqlike.userId);
    }
    userFromDB.likes = likes;
    const UpUser = userFromDB;
    const updatedUser = await coll.findOneAndReplace({ _id: userId }, UpUser);
    res.status(200).json(updatedUser);
}

export async function login(req: any, res: any) {
    const credentials: Credentials = req.body.loginInfo;
    console.table(credentials);
    const h = 2;

    const foundUser = (await findUser(credentials).then((res) => { return res }))
    if (foundUser) {
        const jwtToken = jwt.sign({ email: credentials.email }, RSA_KEY, {
            algorithm: 'RS256',
            expiresIn: '2 hours',
            subject: credentials.email,
        });
        const currentTime = new Date();
        res.status(200).json({
            emailToken: jwtToken,
            expiresIn: currentTime.setTime(currentTime.getTime() + (h * 60 * 60 * 1000)),
            credentials: foundUser
        });
    }
    else {
        res.status(404).end();
    }
}

async function getUserById(id: string) {
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('users');
    const userFromDB = await coll.find({ _id: new mongo.ObjectId(id) }).toArray();
    console.table(userFromDB[0]);
    return userFromDB[0];
}

app.route('/api/profile').post(editProfile);

app.route('/api/profile/:userId').get(async (req, res) => {
    const user = await getUserById(req.params['userId']);
    res.json(user);
});

app.route('/api/like').post(like);

app.route('/api/register').post(register);

app.route('/api/login').post(login);

app.listen(4000, IP, async () => {
    console.log("Server launched");
    try {
        await MongoHelper.connect(url);
        console.info(`Connected to Mongo!`);
    } catch (err) {
        console.error(`Unable to connect to Mongo!`, err);
    }
})