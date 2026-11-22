export const readJsonResponse = async (response) => {
    const body = await response.text();

    if (!body.trim()) {
        return null;
    }

    try {
        return JSON.parse(body);
    } catch {
        return null;
    }
};

export const getApiErrorMessage = (error, fallback) =>
    error instanceof TypeError
        ? "Could not connect to the PersonalStorage server. Check your connection and try again."
        : error?.message || fallback;
