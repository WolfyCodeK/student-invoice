# Moving data between PCs, and backups

Everything a user has set up can be exported to one file and imported on
another PC running Student Invoice: templates, the selected template,
settings (including the custom email body, Your name, any edited term
dates, the charging options and every half-term's record) and the theme.
Gmail isn't included; the user connects Gmail again on the new PC. Neither
is Low memory mode, which is a setting for each PC (see
[performance](performance.md#low-memory-mode)).

The UI lives in Settings → **Your data** (`app/src/features/settings/data-group.tsx`).

## Export

1. The store builds the file with `buildBackup` (`app/src/lib/backup.ts`).
   Google client credentials are removed; tokens never exist in the webview
   in the first place.
2. `export_backup(content, suggestedName)` (`app/src-tauri/src/backup.rs`)
   opens the native **Save** dialog from Rust. The webview never chooses a
   path.
3. Rust checks the size (max 5 MB) and the envelope, then writes the file
   atomically (temporary file, then rename). The suggested name is
   `Student Invoice backup YYYY-MM-DD.json`.

## Import

1. `import_backup()` opens the native **Open** dialog from Rust, rejects files
   over 5 MB before reading them, strips a UTF-8 byte-order mark, requires
   valid UTF-8, and checks the envelope. It returns the file's text.
2. `parseBackup` (`app/src/lib/backup-parse.ts`, loaded with the Settings
   screen, which is the only place that imports files) validates
   everything strictly with zod
   (`app/src/lib/schema/index.ts`):
   - it drops `__proto__`, `constructor` and `prototype` keys while parsing;
   - it enforces generous length limits, the same ones the editors stop
     typing at (`MAX_LENGTH` in `app/src/lib/schema/constants.ts`), so every
     export can be imported again;
   - `day` must be a weekday name, `cost` a finite number of at least 0, and
     template ids must be unique;
   - edited term dates (`settings.termDates`) must be keyed by a four-digit
     year, each with exactly six `{start, end}` pairs of real
     `yyyy-MM-dd` dates;
   - half-term records (`settings.halfTerms`, v1.1.2) must be keyed like
     `2026-0` (a school year and a half-term from 0 to 5), with real dates,
     an ISO `savedAt`, figures that are finite and not negative, and the
     same length limits as families; a reason for an uncharged lesson is any
     short text, so a newer version's reasons still import;
   - no unexpected top-level fields are allowed;
   - a newer `formatVersion` is refused with "update the app first".
3. A confirmation shows the number of templates, the date and the app version
   of the file. **Replace everything** replaces all current data with the
   file's, except the half-term records: those are merged (`mergeRecords`),
   keeping every half-term in either copy and, where both have one, the one
   saved most recently, so history is never lost
   ([data model](data-model.md#half-term-records)).
4. Before replacing, a `pre-import` automatic backup of the current data is
   saved. If that fails, nothing is replaced. The app then reloads.

## Automatic backups

They are stored in `%LOCALAPPDATA%\com.isaac.student-invoice\backups\`, as
files named `<UTC timestamp>-<reason>.json` (e.g.
`20260926T153000Z-daily.json`). They use the same format as exports.

| Reason | When |
|---|---|
| `daily` | On start-up, at most once per UTC day, if there are any templates or half-term records |
| `pre-import` | Before an import replaces the data |
| `pre-restore` | Before restoring an automatic backup |
| `pre-update` | Before installing an app update (best effort) |
| `pre-migration` | Before stored data from an older version is upgraded (only if there is data to protect) |
| `pre-delete` | Before a family is deleted. If it can't be saved, nothing is deleted |

- **Retention:** the newest 10 of each reason are kept.
- **One at a time:** writing a backup and pruning old ones is serialised in
  Rust, so two backups started together (for example by React's development
  double-run) can't collide. The work runs off the main thread.
- **Development builds** use a separate `backups-dev` folder, so testing
  never mixes with the installed app's backups.
- **Restoring:** Settings lists the backups, each labelled with its reason
  (such as "Before deleting a family"), and **Restore** works like an
  import, merging the half-term records in the same way.
- **Opening the folder:** **Open folder** shows the backups in File Explorer.
- **Security:** backup names from the UI must match the exact pattern above,
  so no paths can be passed.

## File format

`formatVersion` 1. The format is generated from `backupFileSchema`:

<!-- GEN:backup-schema -->
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "app": {
      "type": "string",
      "const": "student-invoice"
    },
    "kind": {
      "type": "string",
      "const": "backup"
    },
    "formatVersion": {
      "type": "integer",
      "minimum": 1,
      "maximum": 9007199254740991
    },
    "appVersion": {
      "type": "string",
      "maxLength": 40
    },
    "exportedAt": {
      "type": "string",
      "format": "date-time",
      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
    },
    "data": {
      "type": "object",
      "properties": {
        "store": {
          "type": "object",
          "properties": {
            "templates": {
              "maxItems": 2000,
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 100
                  },
                  "recipient": {
                    "type": "string",
                    "maxLength": 5000
                  },
                  "cost": {
                    "type": "number",
                    "minimum": 0
                  },
                  "instrument": {
                    "type": "string",
                    "maxLength": 1000
                  },
                  "day": {
                    "type": "string",
                    "enum": [
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                      "Sunday"
                    ]
                  },
                  "students": {
                    "type": "string",
                    "maxLength": 5000
                  },
                  "skippedLessonDates": {
                    "maxItems": 500,
                    "type": "array",
                    "items": {
                      "type": "string",
                      "format": "date",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"
                    }
                  },
                  "chargedBankHolidays": {
                    "maxItems": 500,
                    "type": "array",
                    "items": {
                      "type": "string",
                      "format": "date",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"
                    }
                  },
                  "createdAt": {
                    "type": "string",
                    "maxLength": 40
                  },
                  "updatedAt": {
                    "type": "string",
                    "maxLength": 40
                  }
                },
                "required": [
                  "id",
                  "recipient",
                  "cost",
                  "instrument",
                  "day",
                  "students"
                ],
                "additionalProperties": {}
              }
            },
            "currentTemplateId": {
              "anyOf": [
                {
                  "type": "string",
                  "maxLength": 100
                },
                {
                  "type": "null"
                }
              ]
            },
            "settings": {
              "type": "object",
              "properties": {
                "theme": {
                  "type": "string",
                  "enum": [
                    "light",
                    "dark"
                  ]
                },
                "customEmailBodyTemplate": {
                  "type": "string",
                  "maxLength": 200000
                },
                "colourScheme": {
                  "type": "string",
                  "maxLength": 40
                },
                "corners": {
                  "type": "string",
                  "maxLength": 40
                },
                "lastSeenVersion": {
                  "type": "string",
                  "maxLength": 40
                },
                "yourName": {
                  "type": "string",
                  "maxLength": 200
                },
                "termDates": {
                  "type": "object",
                  "propertyNames": {
                    "type": "string",
                    "pattern": "^\\d{4}$"
                  },
                  "additionalProperties": {
                    "minItems": 6,
                    "maxItems": 6,
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "start": {
                          "type": "string",
                          "format": "date",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"
                        },
                        "end": {
                          "type": "string",
                          "format": "date",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"
                        }
                      },
                      "required": [
                        "start",
                        "end"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "charging": {
                  "type": "object",
                  "properties": {
                    "insideHalfTermOnly": {
                      "type": "boolean"
                    },
                    "skipBankHolidays": {
                      "type": "boolean"
                    },
                    "nextHalfTermInHolidays": {
                      "type": "boolean"
                    }
                  },
                  "additionalProperties": {}
                },
                "halfTerms": {
                  "type": "object",
                  "propertyNames": {
                    "type": "string",
                    "pattern": "^\\d{4}-[0-5]$"
                  },
                  "additionalProperties": {
                    "type": "object",
                    "properties": {
                      "start": {
                        "type": "string",
                        "format": "date",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"
                      },
                      "end": {
                        "type": "string",
                        "format": "date",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"
                      },
                      "half": {
                        "type": "string",
                        "maxLength": 20
                      },
                      "season": {
                        "type": "string",
                        "maxLength": 20
                      },
                      "families": {
                        "maxItems": 2000,
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "id": {
                              "type": "string",
                              "minLength": 1,
                              "maxLength": 100
                            },
                            "recipient": {
                              "type": "string",
                              "maxLength": 5000
                            },
                            "students": {
                              "type": "string",
                              "maxLength": 5000
                            },
                            "instrument": {
                              "type": "string",
                              "maxLength": 1000
                            },
                            "day": {
                              "type": "string",
                              "maxLength": 20
                            },
                            "cost": {
                              "type": "number",
                              "minimum": 0
                            },
                            "lessons": {
                              "maxItems": 60,
                              "type": "array",
                              "items": {
                                "type": "object",
                                "properties": {
                                  "date": {
                                    "type": "string",
                                    "format": "date",
                                    "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"
                                  },
                                  "charged": {
                                    "type": "boolean"
                                  },
                                  "reason": {
                                    "type": "string",
                                    "maxLength": 40
                                  }
                                },
                                "required": [
                                  "date",
                                  "charged"
                                ],
                                "additionalProperties": {}
                              }
                            },
                            "lessonCount": {
                              "type": "integer",
                              "minimum": 0,
                              "maximum": 60
                            },
                            "total": {
                              "type": "number",
                              "minimum": 0
                            },
                            "paid": {
                              "type": "boolean"
                            },
                            "thanked": {
                              "type": "boolean"
                            },
                            "removedAt": {
                              "type": "string",
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
                            }
                          },
                          "required": [
                            "id",
                            "recipient",
                            "students",
                            "instrument",
                            "day",
                            "cost",
                            "lessons",
                            "lessonCount",
                            "total"
                          ],
                          "additionalProperties": {}
                        }
                      },
                      "charging": {
                        "type": "object",
                        "properties": {
                          "insideHalfTermOnly": {
                            "type": "boolean"
                          },
                          "skipBankHolidays": {
                            "type": "boolean"
                          },
                          "nextHalfTermInHolidays": {
                            "type": "boolean"
                          }
                        },
                        "additionalProperties": {}
                      },
                      "ended": {
                        "type": "boolean"
                      },
                      "workedOut": {
                        "type": "boolean"
                      },
                      "savedAt": {
                        "type": "string",
                        "format": "date-time",
                        "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
                      }
                    },
                    "required": [
                      "start",
                      "end",
                      "half",
                      "season",
                      "families",
                      "savedAt"
                    ],
                    "additionalProperties": {}
                  }
                }
              },
              "additionalProperties": {}
            }
          },
          "required": [
            "templates",
            "currentTemplateId",
            "settings"
          ],
          "additionalProperties": false
        },
        "theme": {
          "type": "string",
          "enum": [
            "light",
            "dark"
          ]
        }
      },
      "required": [
        "store"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "app",
    "kind",
    "formatVersion",
    "appVersion",
    "exportedAt",
    "data"
  ],
  "additionalProperties": false
}
```
<!-- /GEN:backup-schema -->

**Compatibility:**
- A newer app version must still import every older `formatVersion`.
- Fields added later are optional. Unknown fields inside templates and
  settings are kept, so a file from a newer minor version still imports.
