import { Command } from '#command';
import { db } from '#dbManager';
import { bookmarksCollectionMenuPayload } from '#utils';

class BookmarksCommand extends Command {
        constructor() {
                super({
                        name: 'bookmarks',
                        description: 'View your bookmarked messages',
                        cooldown: 5,
                        enabledSlash: true,
                        prefix: false,
                        ephemeral: true,
                        slashData: {
                                name: 'bookmarks',
                                description: 'View your bookmarked messages',
                        },
                });
        }

        async execute({ ctx }) {
                const bookmarks = await db.user.getBookmarks(ctx.user.id);
                return ctx.editReply(
                        bookmarksCollectionMenuPayload(
                                bookmarks.collections,
                                ctx.user.id,
                        ),
                );
        }
}

export default new BookmarksCommand();
