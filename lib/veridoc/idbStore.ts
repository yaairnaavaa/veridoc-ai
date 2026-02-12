"use client";

import { SavedReport } from "./analysesStore";

export type SavedAnalysisIDB = {
    id: string;
    createdAt: string; // ISO
    labFileName: string;
    pdfFile: File | Blob;
    pdfUrl?: string; // Cloudinary URL
    report: SavedReport;
};

const DB_NAME = "veridoc-db";
const STORE_NAME = "analyses";
const DB_VERSION = 2;

/**
 * Opens the IndexedDB database.
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Adds an analysis to the IndexedDB store.
 */
export async function addAnalysisIDB(analysis: SavedAnalysisIDB): Promise<void> {
    console.log("IDB: Saving analysis...", analysis.id);
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(analysis); // Use put instead of add for idempotency

        request.onsuccess = () => {
            console.log("IDB: Save success!");
            resolve();
        };
        request.onerror = () => {
            console.error("IDB: Save error", request.error);
            reject(request.error);
        };
    });
}

/**
 * Retrieves all analyses from the IndexedDB store.
 */
export async function getAllAnalysesIDB(): Promise<SavedAnalysisIDB[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const results = request.result as SavedAnalysisIDB[];
            // Sort by newest first
            resolve(results.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)));
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Retrieves a single analysis by ID.
 */
export async function getAnalysisIDB(id: string): Promise<SavedAnalysisIDB | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Removes an analysis from the IndexedDB store.
 */
export async function removeAnalysisIDB(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Updates an analysis (e.g., adding a Cloudinary URL).
 */
export async function updateAnalysisIDB(analysis: SavedAnalysisIDB): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(analysis);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
