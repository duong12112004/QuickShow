import Wallet from "../models/Wallet.js";
import WalletTransaction from "../models/WalletTransaction.js";

export const WALLET_TRANSACTION_TYPE = {
    CREDIT: "CREDIT",
    DEBIT: "DEBIT",
    REVERSAL: "REVERSAL"
};

export const getOrCreateWallet = async (userId) => {
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
        wallet = await Wallet.create({ user: userId, balance: 0 });
    }

    return wallet;
};

export const getWalletSummary = async (userId, transactionLimit = 8) => {
    const wallet = await getOrCreateWallet(userId);
    const transactions = await WalletTransaction.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(transactionLimit)
        .populate("booking", "bookingCode movieTitle amount refundAmount refundFeeAmount");

    return {
        balance: wallet.balance || 0,
        currency: wallet.currency || "VND",
        transactions
    };
};

export const creditWallet = async ({
    userId,
    bookingId = null,
    amount,
    note = "",
    metadata = {}
}) => {
    const creditAmount = Math.max(Math.floor(Number(amount || 0)), 0);

    if (creditAmount <= 0) {
        return null;
    }

    const wallet = await Wallet.findOneAndUpdate(
        { user: userId },
        { $inc: { balance: creditAmount }, $setOnInsert: { user: userId, currency: "VND" } },
        { new: true, upsert: true }
    );

    return WalletTransaction.create({
        user: userId,
        booking: bookingId,
        type: WALLET_TRANSACTION_TYPE.CREDIT,
        amount: creditAmount,
        balanceAfter: wallet.balance,
        currency: wallet.currency || "VND",
        note,
        metadata
    });
};

export const debitWallet = async ({
    userId,
    bookingId = null,
    amount,
    note = "",
    metadata = {}
}) => {
    const debitAmount = Math.max(Math.floor(Number(amount || 0)), 0);

    if (debitAmount <= 0) {
        return null;
    }

    const wallet = await Wallet.findOneAndUpdate(
        { user: userId, balance: { $gte: debitAmount } },
        { $inc: { balance: -debitAmount } },
        { new: true }
    );

    if (!wallet) {
        throw new Error("Số dư ví QuickShow không đủ để thanh toán.");
    }

    return WalletTransaction.create({
        user: userId,
        booking: bookingId,
        type: WALLET_TRANSACTION_TYPE.DEBIT,
        amount: debitAmount,
        balanceAfter: wallet.balance,
        currency: wallet.currency || "VND",
        note,
        metadata
    });
};

export const reverseWalletDebit = async ({
    userId,
    bookingId = null,
    amount,
    note = "",
    metadata = {}
}) => {
    const reversalAmount = Math.max(Math.floor(Number(amount || 0)), 0);

    if (reversalAmount <= 0) {
        return null;
    }

    const wallet = await Wallet.findOneAndUpdate(
        { user: userId },
        { $inc: { balance: reversalAmount }, $setOnInsert: { user: userId, currency: "VND" } },
        { new: true, upsert: true }
    );

    return WalletTransaction.create({
        user: userId,
        booking: bookingId,
        type: WALLET_TRANSACTION_TYPE.REVERSAL,
        amount: reversalAmount,
        balanceAfter: wallet.balance,
        currency: wallet.currency || "VND",
        note,
        metadata
    });
};
