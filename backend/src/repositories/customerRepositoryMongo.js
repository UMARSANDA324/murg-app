const { Customer, Debt, Deposit } = require('../models');
const { mongoose } = require('../config/mongodb');

/**
 * CustomerRepositoryMongo — MongoDB-based customer operations.
 */
class CustomerRepositoryMongo {
  async findAll(facilityID) {
    return await Customer.find({ facilityID }).lean();
  }

  async findById(id, facilityID) {
    return await Customer.findOne({ _id: id, facilityID }).lean();
  }

  async create({ name, phone, facilityID, address }) {
    const customer = await Customer.create({
      name,
      phone,
      facilityID,
      address,
      mysqlId: Date.now(),
    });
    return customer;
  }

  async update(id, facilityID, { name, phone, address }) {
    const result = await Customer.updateOne(
      { _id: id, facilityID },
      { name, phone, address }
    );
    return result.modifiedCount > 0;
  }

  async createDeposit({ customerID, facilityID, amount, payment_date, receipt_number }) {
    const deposit = await Deposit.create({
      customerID,
      facilityID,
      amount,
      payment_date,
      receipt_number,
      mysqlId: Date.now(),
    });

    // Update debt balance
    await Debt.updateOne(
      { customerID, facilityID },
      { $inc: { balance: -amount }, last_payment: amount, last_payment_date: payment_date }
    );

    return deposit;
  }

  async getDeposits(customerID, facilityID) {
    return await Deposit.find({ customerID, facilityID })
      .sort({ payment_date: -1 })
      .lean();
  }

  async getDebt(customerID, facilityID) {
    return await Debt.findOne({ customerID, facilityID }).lean();
  }
}

module.exports = new CustomerRepositoryMongo();
