import { ONE_YEAR_IN_MS, WORKSPACE_ID_COOKIE_KEY } from "@/utils/constants";
import { generateId } from "@/utils/id";
import Cookies from "cookies";
import { type GetServerSideProps } from "next";

export default function Home() {
  return <div>Main page</div>;
}

export const getServerSideProps: GetServerSideProps = async function ({
  req,
  res,
}) {
  const cookie = new Cookies(req, res);

  let workspaceId = cookie.get(WORKSPACE_ID_COOKIE_KEY);

  if (workspaceId) {
    return {
      props: {},
      redirect: {
        destination: `/m/${workspaceId}`,
      },
    };
  }

  workspaceId = generateId("workspace");

  cookie.set(WORKSPACE_ID_COOKIE_KEY, workspaceId, {
    expires: new Date(Date.now() + ONE_YEAR_IN_MS),
  });

  return {
    props: {},
    redirect: {
      destination: `/m/${workspaceId}`,
    },
  };
};
