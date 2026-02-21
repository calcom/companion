import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOutOfOfficeEntry,
  deleteOutOfOfficeEntry,
  getOutOfOfficeEntries,
  updateOutOfOfficeEntry,
} from "@/services/calcom/ooo";
import type {
  CreateOutOfOfficeEntryInput,
  OutOfOfficeEntry,
  UpdateOutOfOfficeEntryInput,
} from "@/services/types/ooo.types";

const OOO_QUERY_KEY = ["outOfOfficeEntries"];

export function useOutOfOfficeEntries() {
  return useQuery<OutOfOfficeEntry[], Error>({
    queryKey: OOO_QUERY_KEY,
    queryFn: () => getOutOfOfficeEntries(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useCreateOutOfOfficeEntry() {
  const queryClient = useQueryClient();

  return useMutation<OutOfOfficeEntry, Error, CreateOutOfOfficeEntryInput>({
    mutationFn: (input) => createOutOfOfficeEntry(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OOO_QUERY_KEY });
    },
  });
}

export function useUpdateOutOfOfficeEntry() {
  const queryClient = useQueryClient();

  return useMutation<OutOfOfficeEntry, Error, { id: number } & UpdateOutOfOfficeEntryInput>({
    mutationFn: ({ id, ...input }) => updateOutOfOfficeEntry(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OOO_QUERY_KEY });
    },
  });
}

export function useDeleteOutOfOfficeEntry() {
  const queryClient = useQueryClient();

  return useMutation<OutOfOfficeEntry, Error, number>({
    mutationFn: (id) => deleteOutOfOfficeEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OOO_QUERY_KEY });
    },
  });
}
