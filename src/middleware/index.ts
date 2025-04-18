import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
	const { url, request } = context;
	const pathname = new URL(url).pathname;

	if (pathname === "/") {
		const acceptLanguage = request.headers.get("accept-language") || "";
		const preferredLang = acceptLanguage.split(",")[0].split("-")[0];

		const redirectLang = preferredLang === "vi" ? "vi" : "en";

		return context.redirect(`/${redirectLang}${pathname}`);
	}

	return next();
});
