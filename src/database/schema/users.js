import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
        {
                _id: { type: String },
                addresses: {
                        type: Map,
                        of: String,
                        default: {},
                },
                bookmarks: {
                        collections: {
                                type: [
                                        {
                                                id: { type: String, required: true },
                                                name: { type: String, required: true },
                                                createdAt: { type: Date, default: Date.now },
                                                items: {
                                                        type: [
                                                                {
                                                                        messageId: { type: String, required: true },
                                                                        channelId: { type: String, required: true },
                                                                        guildId: { type: String, default: null },
                                                                        authorId: { type: String, default: null },
                                                                        authorTag: { type: String, default: 'Unknown' },
                                                                        content: { type: String, default: '' },
                                                                        url: { type: String, default: null },
                                                                        createdTimestamp: { type: Number, default: null },
                                                                        bookmarkedAt: { type: Date, default: Date.now },
                                                                },
                                                        ],
                                                        default: [],
                                                },
                                        },
                                ],
                                default: [],
                        },
                },
                tts: {
                        cartesia: {
                                apiKey: { type: String, default: null },
                                voice: { type: String, default: '' },
                                model: { type: String, default: '' },
                        },
                },
                premiumExpiresAt: { type: Date, default: null },
        },
        {
                timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
        },
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
