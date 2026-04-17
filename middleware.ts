import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;

  const publicPaths = ["/login", "/forgot-password", "/reset-password", "/manager/login"];
  const isPublic = publicPaths.some((p) => path === p || path.startsWith(p + "/"));

  if (isPublic && isLoggedIn) {
    const url = req.nextUrl.clone();
    if (path === "/manager/login" || path.startsWith("/manager/login/")) {
      url.pathname = req.auth?.user?.role === "ADMIN" ? "/audits/manager" : "/dashboard";
    } else {
      url.pathname = "/dashboard";
    }
    return Response.redirect(url);
  }

  if (!isPublic && !isLoggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", path);
    return Response.redirect(url);
  }

  const adminOnlyPaths = ["/staff", "/audit", "/performance"];
  const isAdminOnly = adminOnlyPaths.some((p) => path === p || path.startsWith(p + "/"));
  if (isAdminOnly && req.auth?.user?.role !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return Response.redirect(url);
  }

  return undefined;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
