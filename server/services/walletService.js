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

export const getWalletSummary = async (userId, {
    page = 1,
    limit = 8,
    type = "",
    status = ""
} = {}) => {
    const wallet = await getOrCreateWallet(userId);
    const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 8, 1), 300);
    const query = { user: userId };

    if (type) {
        query.type = type;
    }

    if (status) {
        query.status = status;
    }

    const [transactions, totalTransactions] = await Promise.all([
        WalletTransaction.find(query)
            .sort({ createdAt: -1 })
            .skip((normalizedPage - 1) * normalizedLimit)
            .limit(normalizedLimit)
            .populate("booking", "bookingCode movieTitle amount refundAmount refundFeeAmount"),
        WalletTransaction.countDocuments(query)
    ]);

    return {
        balance: wallet.balance || 0,
        currency: wallet.currency || "VND",
        transactions,
        pagination: {
            page: normalizedPage,
            limit: normalizedLimit,
            totalTransactions,
            totalPages: Math.max(Math.ceil(totalTransactions / normalizedLimit), 1)
        }
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
