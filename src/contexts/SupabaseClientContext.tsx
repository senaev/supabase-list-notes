import {
  createContext,
  PropsWithChildren,
  useContext,
  useRef,
  useState,
} from "react";
import {
  SUPABASE_CONTROLLER_STATUS_REQUIRE_CREDENTIALS,
  SupabaseController,
  SupabaseControllerStatus,
} from "../controllers/SupabaseController";

const SupabaseClientContext = createContext<SupabaseControllerStatus>(
  SUPABASE_CONTROLLER_STATUS_REQUIRE_CREDENTIALS,
);
SupabaseClientContext.displayName = "SupabaseClientContext";

const getSupabaseClient = (): [number, SupabaseControllerStatus] => {
  const [ver, setVer] = useState<number>(0);

  const ref = useRef<SupabaseController | null>(null);
  if (!ref.current) {
    ref.current = new SupabaseController({
      onChange: () => {
        setVer((prev) => prev + 1);
      },
    });
  }
  const val = ref.current;

  return [ver, val.status];
};

export function SupabaseClientContextProvider({ children }: PropsWithChildren) {
  const supabaseStatusObject = getSupabaseClient()[1];

  return (
    <SupabaseClientContext.Provider value={supabaseStatusObject}>
      {children}
    </SupabaseClientContext.Provider>
  );
}

export const useSupabaseClientContext = (): SupabaseControllerStatus => {
  return useContext(SupabaseClientContext);
};
