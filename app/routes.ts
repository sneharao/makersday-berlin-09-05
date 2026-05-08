import { flatRoutes } from "remix-flat-routes";
import { remixRoutesOptionAdapter } from "@react-router/remix-routes-option-adapter";

export default remixRoutesOptionAdapter((define_routes) => {
  return flatRoutes(["routes/pages", "routes/api"], define_routes);
});
