import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest
} from "fastify";
import type { TokenClaims } from "@door010/identity-profile";
import type { NotificationProvider } from "@door010/integrations";
import { z } from "zod";
import type {
  AdvisorNote,
  Appointment,
  BackofficeAlert,
  BackofficeStatistics,
  CandidateDetail,
  CandidateSummary,
  EducationEvent,
  PhaseFlowContext,
  PhaseSnapshot,
  RouteSession,
  SavedVacancy,
  TalentQuestion,
  TalentTestResult,
  Vacancy,
  VacancyProfileSummary,
  VacancySearch
} from "@door010/parity-flows";


type AuthenticatedRequest = FastifyRequest & {
  auth?: TokenClaims;
};

function requireBackofficeAccess(
  request: FastifyRequest,
  reply: FastifyReply
): boolean {
  const claims = (request as AuthenticatedRequest).auth;

  if (!claims) {
    void reply.code(401).send({
      error: "authentication_required"
    });
    return false;
  }

  if (
    !claims.roles.some((role) =>
      [
        "advisor",
        "administrator",
        "superuser"
      ].includes(role)
    )
  ) {
    void reply.code(403).send({ error: "forbidden" });
    return false;
  }

  return true;
}

export interface ParityFlowServices {
  routeFlow: {
    start(userId?: string): Promise<RouteSession>;
    answer(sessionId: string, answerId: string): Promise<RouteSession>;
    get(sessionId: string): Promise<RouteSession>;
  };
  phaseFlow: {
    evaluate(context: PhaseFlowContext): Promise<PhaseSnapshot>;
    listLatest(
      limit?: number
    ): readonly PhaseSnapshot[] | Promise<readonly PhaseSnapshot[]>;
  };
  talentTest: {
    getQuestions(): readonly TalentQuestion[];
    submit(
      userId: string,
      answers: Readonly<Record<string, string>>
    ): TalentTestResult | Promise<TalentTestResult>;
    findByUserId(
      userId: string
    ): TalentTestResult | null | Promise<TalentTestResult | null>;
  };
  backoffice: {
    listCandidates():
      readonly CandidateSummary[] |
      Promise<readonly CandidateSummary[]>;
    addNote(
      input: Omit<AdvisorNote, "id" | "createdAt">
    ): AdvisorNote | Promise<AdvisorNote>;
    listNotes(
      candidateUserId: string
    ): readonly AdvisorNote[] | Promise<readonly AdvisorNote[]>;
    scheduleAppointment(
      input: Omit<Appointment, "id" | "createdAt">
    ): Appointment | Promise<Appointment>;
    listAppointments(
      candidateUserId: string
    ): readonly Appointment[] | Promise<readonly Appointment[]>;
    getCandidateDetail(
      candidateUserId: string
    ): CandidateDetail | Promise<CandidateDetail>;
    listAlerts():
      readonly BackofficeAlert[] |
      Promise<readonly BackofficeAlert[]>;
    getStatistics():
      BackofficeStatistics |
      Promise<BackofficeStatistics>;
  };
  events: {
    list():
      readonly EducationEvent[] |
      Promise<readonly EducationEvent[]>;
    refresh(force?: boolean): Promise<readonly EducationEvent[]>;
    save(userId: string, eventId: string): void | Promise<void>;
    unsave(userId: string, eventId: string): void | Promise<void>;
    listSaved(
      userId: string
    ): readonly EducationEvent[] | Promise<readonly EducationEvent[]>;
  };
  vacancies: {
    search(search?: VacancySearch): Promise<readonly Vacancy[]>;
    getById(vacancyId: string): Promise<Vacancy | null>;
    save(
      userId: string,
      vacancyId: string,
      notes?: string
    ): Promise<SavedVacancy>;
    remove(
      userId: string,
      vacancyId: string
    ): boolean | Promise<boolean>;
    listSaved(userId: string): Promise<readonly Vacancy[]>;
    getProfileSummary(
      userId: string
    ): Promise<VacancyProfileSummary>;
  };
  notifications: NotificationProvider;
}

export async function registerParityFlowRoutes(
  server: FastifyInstance,
  services: ParityFlowServices
): Promise<void> {
  server.post("/v1/routes/sessions", async (request, reply) => {
    const parsed = z.object({
      userId: z.string().uuid().optional()
    }).safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }

    return services.routeFlow.start(parsed.data.userId);
  });

  server.post("/v1/routes/sessions/:sessionId/answers", async (
    request,
    reply
  ) => {
    const params = z.object({
      sessionId: z.string().uuid()
    }).safeParse(request.params);
    const body = z.object({
      answerId: z.string().min(1)
    }).safeParse(request.body);

    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      return await services.routeFlow.answer(
        params.data.sessionId,
        body.data.answerId
      );
    } catch (error) {
      const code = error instanceof Error
        ? error.message
        : "route_flow_failed";
      return reply.code(
        code === "route_session_not_found" ? 404 : 409
      ).send({ error: code });
    }
  });

  server.get("/v1/routes/sessions/:sessionId", async (
    request,
    reply
  ) => {
    const parsed = z.object({
      sessionId: z.string().uuid()
    }).safeParse(request.params);

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      return await services.routeFlow.get(parsed.data.sessionId);
    } catch {
      return reply.code(404).send({
        error: "route_session_not_found"
      });
    }
  });

  server.post("/v1/phases/evaluate", async (request, reply) => {
    const parsed = z.object({
      organizationId: z.string().optional(),
      userId: z.string().uuid(),
      conversationId: z.string().uuid().optional(),
      currentPhaseCode: z.string().optional(),
      completedPhaseCodes: z.array(z.string()).optional(),
      slots: z.array(z.object({
        key: z.string(),
        value: z.unknown(),
        confidence: z.number().min(0).max(1),
        source: z.enum([
          "user",
          "advisor",
          "model",
          "rule",
          "import"
        ]),
        updatedAt: z.string()
      })),
      selectedEntities: z.record(
        z.union([z.string(), z.null()])
      ).optional(),
      events: z.array(z.string()).optional(),
      intents: z.array(z.string()).optional()
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }

    return services.phaseFlow.evaluate({
      ...parsed.data,
      knownSlots: parsed.data.slots as never
    });
  });

  server.get("/v1/backoffice/detector-snapshots", async (
    request,
    reply
  ) => {
    if (!requireBackofficeAccess(request, reply)) return;

    const parsed = z.object({
      limit: z.coerce.number().int().min(1).max(100).optional()
    }).safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    return {
      snapshots: await services.phaseFlow.listLatest(
        parsed.data.limit ?? 50
      )
    };
  });

  server.get("/v1/talent-test/questions", async () => ({
    questions: services.talentTest.getQuestions()
  }));

  server.post("/v1/talent-test/submit", async (request, reply) => {
    const parsed = z.object({
      userId: z.string().uuid(),
      answers: z.record(z.string())
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }

    try {
      return await services.talentTest.submit(
        parsed.data.userId,
        parsed.data.answers
      );
    } catch (error) {
      return reply.code(409).send({
        error: error instanceof Error
          ? error.message
          : "talent_test_failed"
      });
    }
  });

  server.get("/v1/talent-test/results/:userId", async (
    request,
    reply
  ) => {
    const parsed = z.object({
      userId: z.string().uuid()
    }).safeParse(request.params);

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const result = await services.talentTest.findByUserId(
      parsed.data.userId
    );
    return result
      ? result
      : reply.code(404).send({
          error: "talent_test_result_not_found"
        });
  });

  server.get("/v1/backoffice/candidates", async (
    request,
    reply
  ) => {
    if (!requireBackofficeAccess(request, reply)) return;

    return {
      candidates: await services.backoffice.listCandidates()
    };
  });


  server.get("/v1/backoffice/statistics", async (
    request,
    reply
  ) => {
    if (!requireBackofficeAccess(request, reply)) return;

    return {
      statistics: await services.backoffice.getStatistics()
    };
  });

  server.get("/v1/backoffice/alerts", async (
    request,
    reply
  ) => {
    if (!requireBackofficeAccess(request, reply)) return;

    return {
      alerts: await services.backoffice.listAlerts()
    };
  });

  server.get("/v1/backoffice/candidates/:candidateUserId", async (
    request,
    reply
  ) => {
    if (!requireBackofficeAccess(request, reply)) return;

    const parsed = z.object({
      candidateUserId: z.string().uuid()
    }).safeParse(request.params);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request"
      });
    }

    try {
      return {
        detail: await services.backoffice.getCandidateDetail(
          parsed.data.candidateUserId
        )
      };
    } catch {
      return reply.code(404).send({
        error: "candidate_not_found"
      });
    }
  });

  server.post("/v1/backoffice/candidates/:candidateUserId/notes", async (
    request,
    reply
  ) => {
    if (!requireBackofficeAccess(request, reply)) return;
    const params = z.object({
      candidateUserId: z.string().uuid()
    }).safeParse(request.params);
    const body = z.object({
      advisorUserId: z.string().uuid(),
      content: z.string().trim().min(1).max(10_000)
    }).safeParse(request.body);

    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    return await services.backoffice.addNote({
      candidateUserId: params.data.candidateUserId,
      advisorUserId: body.data.advisorUserId,
      content: body.data.content
    });
  });

  server.get("/v1/backoffice/candidates/:candidateUserId/notes", async (
    request,
    reply
  ) => {
    if (!requireBackofficeAccess(request, reply)) return;
    const parsed = z.object({
      candidateUserId: z.string().uuid()
    }).safeParse(request.params);

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    return {
      notes: await services.backoffice.listNotes(
        parsed.data.candidateUserId
      )
    };
  });

  server.post("/v1/backoffice/appointments", async (
    request,
    reply
  ) => {
    if (!requireBackofficeAccess(request, reply)) return;
    const parsed = z.object({
      candidateUserId: z.string().uuid(),
      advisorUserId: z.string().uuid(),
      subject: z.string().trim().min(1),
      description: z.string().optional(),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      timezone: z.string().default("Europe/Amsterdam"),
      status: z.enum([
        "requested",
        "confirmed",
        "rescheduled",
        "completed",
        "cancelled",
        "no_show"
      ]).default("confirmed"),
      location: z.string().optional(),
      meetingUrl: z.string().url().optional()
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }

    try {
      const appointment =
        await services.backoffice.scheduleAppointment(parsed.data);

      try {
        const notification = await services.notifications.send({
          recipient: parsed.data.candidateUserId,
          templateKey: "appointment-created",
          subject: parsed.data.subject,
          variables: {
            candidateUserId: parsed.data.candidateUserId,
            advisorUserId: parsed.data.advisorUserId,
            startsAt: parsed.data.startsAt,
            endsAt: parsed.data.endsAt,
            timezone: parsed.data.timezone,
            status: parsed.data.status
          }
        });

        return {
          ...appointment,
          notification: {
            sent: true,
            messageId: notification.messageId
          }
        };
      } catch {
        return {
          ...appointment,
          notification: {
            sent: false
          }
        };
      }
    } catch (error) {
      return reply.code(409).send({
        error: error instanceof Error
          ? error.message
          : "appointment_failed"
      });
    }
  });

  server.get(
    "/v1/backoffice/candidates/:candidateUserId/appointments",
    async (request, reply) => {
      if (!requireBackofficeAccess(request, reply)) return;

      const parsed = z.object({
        candidateUserId: z.string().uuid()
      }).safeParse(request.params);

      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      return {
        appointments: await services.backoffice.listAppointments(
          parsed.data.candidateUserId
        )
      };
    }
  );

  server.get("/v1/events", async () => ({
    events: await services.events.list()
  }));

  server.post("/v1/events/refresh", async (request, reply) => {
    const parsed = z.object({
      force: z.boolean().optional()
    }).safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    return {
      events: await services.events.refresh(
        parsed.data.force ?? false
      )
    };
  });

  server.post("/v1/events/:eventId/save", async (
    request,
    reply
  ) => {
    const params = z.object({
      eventId: z.string().uuid()
    }).safeParse(request.params);
    const body = z.object({
      userId: z.string().uuid()
    }).safeParse(request.body);

    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      await services.events.save(body.data.userId, params.data.eventId);
      return { saved: true };
    } catch {
      return reply.code(404).send({ error: "event_not_found" });
    }
  });

  server.delete("/v1/events/:eventId/save", async (
    request,
    reply
  ) => {
    const params = z.object({
      eventId: z.string().uuid()
    }).safeParse(request.params);
    const query = z.object({
      userId: z.string().uuid()
    }).safeParse(request.query);

    if (!params.success || !query.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    await services.events.unsave(query.data.userId, params.data.eventId);
    return { saved: false };
  });

  server.get("/v1/users/:userId/saved-events", async (
    request,
    reply
  ) => {
    const parsed = z.object({
      userId: z.string().uuid()
    }).safeParse(request.params);

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    return {
      events: await services.events.listSaved(parsed.data.userId)
    };
  });

server.get("/v1/vacancies", async (request, reply) => {
  const parsed = z.object({
    query: z.string().optional(),
    sector: z.string().optional(),
    organization: z.string().optional(),
    location: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  }).safeParse(request.query);

  if (!parsed.success) {
    return reply.code(400).send({
      error: "invalid_request",
      details: parsed.error.flatten()
    });
  }

  return {
    vacancies: await services.vacancies.search(parsed.data)
  };
});

server.get("/v1/vacancies/:vacancyId", async (
  request,
  reply
) => {
  const parsed = z.object({
    vacancyId: z.string().min(1)
  }).safeParse(request.params);

  if (!parsed.success) {
    return reply.code(400).send({ error: "invalid_request" });
  }

  const vacancy = await services.vacancies.getById(
    parsed.data.vacancyId
  );
  return vacancy
    ? vacancy
    : reply.code(404).send({ error: "vacancy_not_found" });
});

server.post("/v1/vacancies/:vacancyId/save", async (
  request,
  reply
) => {
  const params = z.object({
    vacancyId: z.string().min(1)
  }).safeParse(request.params);
  const body = z.object({
    userId: z.string().uuid(),
    notes: z.string().trim().max(5_000).optional()
  }).safeParse(request.body);

  if (!params.success || !body.success) {
    return reply.code(400).send({ error: "invalid_request" });
  }

  try {
    return {
      saved: await services.vacancies.save(
        body.data.userId,
        params.data.vacancyId,
        body.data.notes
      )
    };
  } catch {
    return reply.code(404).send({
      error: "vacancy_not_found"
    });
  }
});

server.delete("/v1/vacancies/:vacancyId/save", async (
  request,
  reply
) => {
  const params = z.object({
    vacancyId: z.string().min(1)
  }).safeParse(request.params);
  const query = z.object({
    userId: z.string().uuid()
  }).safeParse(request.query);

  if (!params.success || !query.success) {
    return reply.code(400).send({ error: "invalid_request" });
  }

  return {
    removed: await services.vacancies.remove(
      query.data.userId,
      params.data.vacancyId
    )
  };
});

server.get("/v1/users/:userId/saved-vacancies", async (
  request,
  reply
) => {
  const parsed = z.object({
    userId: z.string().uuid()
  }).safeParse(request.params);

  if (!parsed.success) {
    return reply.code(400).send({ error: "invalid_request" });
  }

  return {
    vacancies: await services.vacancies.listSaved(
      parsed.data.userId
    )
  };
});

server.get("/v1/users/:userId/vacancy-profile", async (
  request,
  reply
) => {
  const parsed = z.object({
    userId: z.string().uuid()
  }).safeParse(request.params);

  if (!parsed.success) {
    return reply.code(400).send({ error: "invalid_request" });
  }

  return services.vacancies.getProfileSummary(parsed.data.userId);
});

}
