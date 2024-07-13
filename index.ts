import { ActivityType, Client, Presence } from "discord.js";
import { Server, Socket } from "socket.io";

let _socket: Socket | undefined;

const client = new Client({
    intents: ["Guilds", "GuildMembers", "GuildPresences"],
});

const io = new Server({
    cors: {
        origin: ["http://localhost:3000", "http://localhost:3001", "https://me.shirokodev.site"],
        credentials: true,
    },
});

const userId = process.env.USER_ID as string;

function parsePresenceData(presence: Presence) {
    const customStatus = presence.activities.find((act) => act.type === ActivityType.Custom);
    const activity = presence.activities.find((act) => act.type !== ActivityType.Custom);
    return {
        user: {
            username: presence.user?.username,
            avatar: presence.user?.displayAvatarURL(),
            displayName: presence.user?.displayName,
            banner: presence.user?.bannerURL(),
            status: {
                type: presence.status,
                devices: presence.clientStatus,
            },
        },
        customStatus: customStatus && {
            state: customStatus.state,
            emoji: {
                name: customStatus.emoji?.name,
                url: customStatus.emoji?.imageURL(),
            },
        },
        activity: activity && {
            name: activity.name,
            url: activity.url,
            details: activity.details,
            state: activity.state,
            assets: activity.assets && {
                smallText: activity.assets.smallText,
                smallImage: activity.assets.smallImageURL(),
                largeText: activity.assets.largeText,
                largeImage: activity.assets.largeImageURL(),
            },
            timestamps: {
                start: activity.timestamps?.start && Number(activity.timestamps.start),
                end: activity.timestamps?.end && Number(activity.timestamps.start),
            },
            createdTimestamp: activity.createdTimestamp,
        },
    };
}

io.on("connection", (socket) => {
    _socket = socket;
    console.log("User connected");
    socket.on("getPresence", () => {
        const g = client.guilds.cache.find((g) => g.members.cache.has(userId));
        if (!g) {
            socket.emit(
                "error",
                JSON.stringify({
                    error: "USER_NOT_FOUND",
                    data: userId,
                    msg: "Wrong user id or bot not ready",
                })
            );
            return socket.disconnect(true);
        }
        const member = g.members.cache.get(userId);
        if (!member) return;

        member.user.fetch(true).then(() => {
            if (member.presence) {
                socket.emit("updatePresence", JSON.stringify(parsePresenceData(member.presence)));
            }
        });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected", userId);
    });
});

client.on("presenceUpdate", (_, newP) => {
    console.log("Update");
    if (newP.userId === userId) {
        _socket?.emit("updatePresence", JSON.stringify(parsePresenceData(newP)));
    }
});

client.on("ready", (bot) => {
    console.log("Login as", bot.user.username);
    io.listen(Number(process.env.PORT) || 1111);
});

client.login(process.env.TOKEN);
