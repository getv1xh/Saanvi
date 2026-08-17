import { UserRepository } from '#dbRepo/users';

export class UserService {
        constructor() {
                this.repo = new UserRepository();
        }

        async getAddress(userId, chainKey) {
                return await this.repo.getAddress(userId, chainKey);
        }

        async setAddress(userId, chainKey, address) {
                await this.repo.setAddress(userId, chainKey, address);
        }

        async removeAddress(userId, chainKey) {
                await this.repo.removeAddress(userId, chainKey);
        }

        async getAllAddresses(userId) {
                return await this.repo.getAllAddresses(userId);
        }

        async getBookmarks(userId) {
                return await this.repo.getBookmarks(userId);
        }

        async createBookmarkCollection(userId, name) {
                return await this.repo.createBookmarkCollection(userId, name);
        }

        async addBookmarkToCollection(userId, collectionId, bookmark) {
                return await this.repo.addBookmarkToCollection(userId, collectionId, bookmark);
        }

        async isPremium(userId) {
                return await this.repo.isPremium(userId);
        }

        async getPremiumExpiresAt(userId) {
                return await this.repo.getPremiumExpiresAt(userId);
        }

        async grantPremium(userId, durationMs) {
                return await this.repo.grantPremium(userId, durationMs);
        }

        async revokePremium(userId) {
                return await this.repo.revokePremium(userId);
        }
}
