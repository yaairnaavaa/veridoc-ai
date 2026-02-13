"use server";

/** Shape of the consultation to save */
export type ConsultationInput = {
    patientAccount: string;
    specialistAccount: string;
    specialistName: string;
    documentUrl: string;
    analysisCommentsAI?: string;
};

/**
 * Sends a consultation request to the backend API.
 */
export async function createConsultationAction(data: ConsultationInput): Promise<{
    success: boolean;
    error?: string;
    data?: any;
}> {
    const baseUrl = process.env.SPECIALIST_VERIFICATION_API_URL;
    if (!baseUrl) {
        return { success: false, error: "SPECIALIST_VERIFICATION_API_URL not set." };
    }

    try {
        const url = `${baseUrl.replace(/\/$/, "")}/api/consultations`;
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
            cache: "no-store",
        });

        const result = await res.json();
        if (!res.ok) {
            return {
                success: false,
                error: result.message || `API Error: ${res.status}`
            };
        }

        return { success: true, data: result.data };
    } catch (e) {
        console.error("Failed to create consultation:", e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Network error"
        };
    }
}

/**
 * Retrieves all consultations for a specific patient account.
 */
export async function getConsultationsByPatientAction(patientAccount: string): Promise<{
    success: boolean;
    error?: string;
    data?: any[];
}> {
    const baseUrl = process.env.SPECIALIST_VERIFICATION_API_URL;
    if (!baseUrl) {
        return { success: false, error: "SPECIALIST_VERIFICATION_API_URL not set." };
    }

    try {
        const url = `${baseUrl.replace(/\/$/, "")}/api/consultations/patient/${patientAccount}`;
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            cache: "no-store",
        });

        const result = await res.json();
        if (!res.ok) {
            return {
                success: false,
                error: result.message || `API Error: ${res.status}`
            };
        }

        return { success: true, data: result.data };
    } catch (e) {
        console.error("Failed to fetch consultations:", e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Network error"
        };
    }
}

/**
 * Retrieves all consultations for a specific specialist account.
 */
export async function getConsultationsBySpecialistAction(specialistAccount: string): Promise<{
    success: boolean;
    error?: string;
    data?: any[];
}> {
    const baseUrl = process.env.SPECIALIST_VERIFICATION_API_URL;
    if (!baseUrl) {
        return { success: false, error: "SPECIALIST_VERIFICATION_API_URL not set." };
    }

    try {
        const url = `${baseUrl.replace(/\/$/, "")}/api/consultations/specialist/${specialistAccount}`;
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            cache: "no-store",
        });

        const result = await res.json();
        if (!res.ok) {
            return {
                success: false,
                error: result.message || `API Error: ${res.status}`
            };
        }

        return { success: true, data: result.data };
    } catch (e) {
        console.error("Failed to fetch specialist consultations:", e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Network error"
        };
    }
}

/**
 * Updates a consultation with the specialist's medical opinion.
 * Backend should set delivered_at and release_after_at when status becomes "attended".
 */
export async function updateConsultationAction(
    id: string,
    data: { status: string; analysisCommentsSpecialist: string }
): Promise<{
    success: boolean;
    error?: string;
    data?: any;
}> {
    const baseUrl = process.env.SPECIALIST_VERIFICATION_API_URL;
    if (!baseUrl) {
        return { success: false, error: "SPECIALIST_VERIFICATION_API_URL not set." };
    }

    try {
        const url = `${baseUrl.replace(/\/$/, "")}/api/consultations/${id}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
            cache: "no-store",
        });

        const result = await res.json();
        if (!res.ok) {
            return {
                success: false,
                error: result.message || `API Error: ${res.status}`
            };
        }

        return { success: true, data: result.data };
    } catch (e) {
        console.error("Failed to update consultation:", e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Network error"
        };
    }
}

/**
 * Confirms payment for a consultation (called after escrow deposit).
 */
export async function confirmPaymentAction(
    consultationId: string,
    txHash: string,
    amountRaw: string
): Promise<{
    success: boolean;
    error?: string;
    data?: any;
}> {
    try {
        const res = await fetch("/api/consultations/confirm-payment", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                consultationId,
                txHash,
                amountRaw,
            }),
            cache: "no-store",
        });

        const result = await res.json();
        if (!res.ok) {
            return {
                success: false,
                error: result.error || result.details || `API Error: ${res.status}`,
            };
        }

        return { success: true, data: result.data };
    } catch (e) {
        console.error("Failed to confirm payment:", e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Network error",
        };
    }
}
