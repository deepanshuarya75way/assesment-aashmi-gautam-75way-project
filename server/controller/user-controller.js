import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';

import Token from '../model/token.js'
import User from '../model/user.js';

dotenv.config();

export const singupUser = async (request, response) => {
    try {
        // const salt = await bcrypt.genSalt();
        // const hashedPassword = await bcrypt.hash(request.body.password, salt);
        const hashedPassword = await bcrypt.hash(request.body.password, 10);

        const user = { username: request.body.username, name: request.body.name, password: hashedPassword }

        const newUser = new User(user);
        await newUser.save();

        return response.status(200).json({ msg: 'Signup successfull' });
    } catch (error) {
        return response.status(500).json({ msg: 'Error while signing up user' });
    }
}


export const loginUser = async (request, response) => {
    let user = await User.findOne({ username: request.body.username });
    if (!user) {
        return response.status(400).json({ msg: 'Username does not match' });
    }

    try {
        const match = await bcrypt.compare(request.body.password, user.password);
        if (!match) return response.status(400).json({ msg: 'Password does not match' })
            
        const takeover = request.query.takeover === 'true'
        if (user.activeSessionId && !takeover) {
            return response.status(409).json({
                code: 'ACTIVE_SESSION_EXISTS' ,
                msg: 'You are already signed in on another device.'
            });
        }

        const sessionId = crypto.randomBytes(16).toString('hex');
        user.activeSessionId=sessionId;
        await user.save();

        const payload={
            _id: user._id,
            name: user.name,
            username: user.username,
            sessionId
        };

        const accessToken = jwt.sign(payload, process.env.ACCESS_SECRET_KEY, {expiresIn: '15m'});
        const refreshToken =jwt.sign(payload,process.env.REFRESH_SECRET_KEY);

        await new Token({token:refreshToken}).save();

        return response.status(200).json({
            accessToken,
            refreshToken,
            name: user.name,
            username: user.username
        });
        
    } catch (error) {
       return response.status(500).json({ msg: 'error while login the user' })
    }
}

export const logoutUser = async (request, response) => {
    const token = request.body.token;
    await Token.deleteOne({ token: token });

    if (request.body.username){
        await User.updateOne({username: request.body.username}, {activeSessionI: null});
    }

    response.status(204).json({ msg: 'logout successfull' });
}