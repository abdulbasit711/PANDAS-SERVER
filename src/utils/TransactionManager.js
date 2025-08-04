import mongoose from "mongoose";

class AppTransaction {
  constructor() {
    this.operations = [];
    this.rollbackOperations = [];
  }

  addOperation(operation, rollback) {
    this.operations.push(operation);
    this.rollbackOperations.push(rollback);
  }

  async execute() {
    try {
      for (const operation of this.operations) {
        await operation();
      }
      console.log("Transaction committed successfully.");
    } catch (error) {
      console.error("Transaction failed. Rolling back changes...", error);
      await this.rollback();
      throw error;
    }
  }

  async rollback() {
    for (let i = this.rollbackOperations.length - 1; i >= 0; i--) {
      try {
        await this.rollbackOperations[i]();
      } catch (rollbackError) {
        console.error("Rollback failed for operation:", rollbackError);
      }
    }
    console.log("Rollback completed.");
  }
}

class TransactionManager {
  async run(transactionLogic) {
    const transaction = new AppTransaction();
    try {
      await transactionLogic(transaction);
      await transaction.execute();
    } catch (error) {
      // The transaction already rolled back in transaction.execute()
      throw error;
    }
  }
}

export {
  TransactionManager,
  AppTransaction,
};