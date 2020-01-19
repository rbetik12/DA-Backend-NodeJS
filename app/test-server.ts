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

import { Photo } from './common/models/photo.interface';
const multipart = require('connect-multiparty');
const multipartMiddleware = multipart({
    uploadDir: './uploads'
});

import { Like } from './common/models/like.interface';
import { ChatRoom } from './common/models/chatroom.interface';
import { PrivateMessage } from './common/models/privateMessage.interface';


const app: express.Application = express();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({
    extended: true,
    limit: '50mb'
}));
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

const http = require('http').Server(app);
const io = require('socket.io')(http);

const RSA_KEY = fs.readFileSync('key.pem');
const url = "mongodb://localhost:27017/readr";
const IP = "ec2-18-222-93-236.us-east-2.compute.amazonaws.com"; // Don't touch that mazafucka, just change it to localhost or don't, better not to touch that. I fucking swear that I'll kill you if you change that

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
const activeRooms: ChatRoom[] = [];

io.on("connection", async (socket: any) => {
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('messages');
    const pmColl = await client.db('readr').collection('pmMessages');
    const mssgs = await coll.find({}).toArray();
    let N = 20;

    socket.on("subscribe", async (IDs: any) => {
        console.log(IDs);
        let roomExist = false;
        let roomId = null;
        console.log(activeRooms);
        for (const room of activeRooms) {
            if (room.person1ID === IDs.twimcId || room.person1ID === IDs.senderId && room.person2ID === IDs.twimcId || room.person2ID === IDs.senderId) {
                roomExist = true;
                roomId = room._id;
            }
        }
        if (roomExist) {
            socket.join(roomId);
        }
        else {
            roomId = (new mongo.ObjectID()).toHexString();
            activeRooms.push({ _id: roomId, person1ID: IDs.senderId, person2ID: IDs.twimcId });
            socket.join(roomId);
        }
        socket.emit("getRoomId", roomId);
        const privateMessages: PrivateMessage[] = await pmColl.find({ $or: [{ twimcId: IDs.twimcId, senderId: IDs.senderId }, { twimcId: IDs.senderId, senderId: IDs.twimcId }] }).toArray();
        console.log("Private messages :" + privateMessages);
        socket.emit("getMessagesFromDB", privateMessages);
    });

    socket.on("sendPMessage", async (data: any) => {
        console.log(data);
        const messageId = new mongo.ObjectID();
        await pmColl.insertOne({ _id: messageId, twimcId: data.twimcId, senderId: data.senderId, text: data.text });
        io.sockets.in(data.roomId).emit('getMessage', { _id: messageId.toHexString(), text: data.text, senderId: data.senderId });
    });

    socket.on("newMessage", async (message: MessageModel) => {
        await coll.insertOne(message);
        const messagesAmount = await coll.count() - N;
        let toSkip = messagesAmount < 0 ? 0 : messagesAmount;
        console.log("New message from client");
        console.table(message);

        N += 1;
        let mssgs: MessageModel[] = await coll.find({}).skip(toSkip).toArray();

        io.emit("join", mssgs);
        mssgs.map((msg) => {
            msg.coefficient = getCoefficient(message.latitude, message.longitude, msg.latitude, msg.longitude);
            return msg;
        });
        socket.emit("join", mssgs);
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

export async function getUserLikes(req: any, res: any) {
    const user: User = await getUserById(req.params['userId']);
    const usersID = user.likes || [];
    const usersWhoLiked: User[] = [];
    for (const id of usersID) {
        usersWhoLiked.push(await getUserById(id));
    }
    res.status(200).json(usersWhoLiked);
}

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
    const answerFromDB: User[] = await coll.find({ email: user.email }).limit(1).toArray();
    console.log(answerFromDB);
    if (answerFromDB.length > 0) {
        res.status(409).json({ status: "User already exists" });
    }
    else {
        coll.insertOne(user);
        console.table(user);
        users.push(user);

        res.status(200).json({ status: "User succefully added" });
    }
}

export async function editProfile(req: any, res: any) {
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('users');
    const user: User = req.body.user;
    const id = new mongo.ObjectID(user._id);
    const userFromDB = await coll.findOneAndUpdate({ _id: id }, { $set: { "about": user.about, "interests": user.interests } });
    console.table(userFromDB);

    res.status(200);
}

export async function like(req: any, res: any) {
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('users');
    const reqlike: Like = req.body;
    const userId = new mongo.ObjectID(reqlike.userWhoGetLiked);
    let userFromDB: User = await coll.findOne({ _id: userId });
    let likes: string[] = userFromDB.likes || [];
    let idExist = false;
    for (let user_id of likes) {
        if (user_id === reqlike.userId) {
            idExist = true;
        }
    }
    if (!idExist) {
        likes.push(reqlike.userId);
        console.log("User with ID: " + reqlike.userId + " liked user with ID: " + reqlike.userWhoGetLiked);
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

async function photoLoader(req: any, res: any) {
    console.log("User with ID " + req.body.user_id + " uploaded photo");
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('photos');
    const photo: Photo = {
        user_id: new mongo.ObjectID(req.body.user_id),
        data: req.body.data
    }
    coll.insertOne(photo)
    res.status(200).json({ status: 'kek' })
}

async function photoGetter(req: any, res: any) {
    console.log("User with ID " + req.params['userId'] + " requested photos");
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('photos');
    const userId = new mongo.ObjectID(req.params['userId']);
    const photos = await coll.find({ user_id: userId }).toArray();
    const fixedPhotos: Photo[] = [];
    for (const photo of photos) {
        let fixedPhoto: Photo = { _id: photo._id, user_id: photo.user_id, data: photo.data.data };
        fixedPhotos.push(fixedPhoto);
    }
    res.status(200).json(fixedPhotos);
}

async function deletePhoto(req: any, res: any) {
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('photos');
    const deletionIDs: string[] = req.body.deletionIDs;
    for (const id of deletionIDs) {
        await coll.deleteOne({ _id: new mongo.ObjectID(id) });
        console.log("Deleted photo with ID: " + id);
    }
    res.status(200).json({ status: "OK" });
}

async function getMutualLikes(req: any, res: any) {
    console.log("User with ID: " + req.params['userId'] + " requested mutual likes");
    const client = await MongoHelper.connect(url);
    const coll = await client.db('readr').collection('users');
    const userId: string = req.params['userId'];
    const currentUserFromDB: User = await coll.findOne({ _id: new mongo.ObjectID(userId) });
    const currentUserLikes: string[] = currentUserFromDB.likes || [];
    const mutualLikes: User[] = [];
    for (const userID of currentUserLikes) {
        const userWhoCouldBeLiked: User = await coll.findOne({ _id: new mongo.ObjectID(userID) });
        for (const likes of userWhoCouldBeLiked.likes) {
            if (likes === userId) { mutualLikes.push(userWhoCouldBeLiked); }
        }
    }
    console.log(mutualLikes);
    res.status(200).json(mutualLikes);
}

app.route('/api/user_likes/:userId').get(getUserLikes);

app.route('/api/profile').post(editProfile);

app.route('/api/profile/:userId').get(async (req, res) => {
    const user = await getUserById(req.params['userId']);
    res.json(user);
});

app.post('/api/photo/upload', multipartMiddleware, photoLoader);

app.get('/api/photo/get/:userId', photoGetter);

app.route('/api/photo/delete').post(deletePhoto);

app.route('/api/like').post(like);

app.route('/api/register').post(register);

app.route('/api/login').post(login);

app.route('/api/users/mutual-like/:userId').get(getMutualLikes);

app.listen(4000, IP, async () => {
    console.log("Server launched");
    try {
        await MongoHelper.connect(url);
        console.info(`Connected to Mongo!`);
    } catch (err) {
        console.error(`Unable to connect to Mongo!`, err);
    }
})