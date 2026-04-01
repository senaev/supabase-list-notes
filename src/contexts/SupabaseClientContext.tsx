import {
  createContext,
  PropsWithChildren,
  useContext,
  useRef,
  useState,
} from "react";
import {
  SUPABASE_CONTROLLER_STATUS_INITIALIZATION,
  SupabaseController,
  SupabaseControllerStatus,
} from "../controllers/SupabaseController";

const SupabaseClientContext = createContext<SupabaseControllerStatus>(
  SUPABASE_CONTROLLER_STATUS_INITIALIZATION,
);
SupabaseClientContext.displayName = "SupabaseClientContext";

export function SupabaseClientContextProvider({ children }: PropsWithChildren) {
  const [, setVer] = useState<number>(0);

  const ref = useRef<SupabaseController | null>(null);
  if (!ref.current) {
    ref.current = new SupabaseController({
      onChange: () => {
        setVer((prev) => prev + 1);
      },
    });
  }

  return (
    <SupabaseClientContext.Provider value={ref.current.status}>
      {children}
    </SupabaseClientContext.Provider>
  );
}

export const useSupabaseClientContext = (): SupabaseControllerStatus => {
  return useContext(SupabaseClientContext);
};
