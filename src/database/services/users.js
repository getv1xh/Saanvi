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
}
