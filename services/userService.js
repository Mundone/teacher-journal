const allModels = require("../models");
const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");
const lessonTypeService = require("./lessonTypeService");
const scheduleService = require("./scheduleService");
const subjectService = require("./subjectService");

const transporter = require("../config/email.config");
const fs = require("fs");
const path = require("path");
const { profileUrl } = require("../config/const");

const getAllUsers = async ({ where, limit, offset, order, isWithoutBody }) => {
  if (isWithoutBody) {
    return await allModels.User.findAll({
      include: [
        {
          model: allModels.UserRole,
          attributes: ["id", "role_name"],
        },
      ],
      attributes: [
        "id",
        "name",
        "email",
        "code",
        "role_id",
        "school_id",
        "profile_image",
        "createdAt",
      ],
    });
  }
  let { count: totalObjects, rows: objects } =
    await allModels.User.findAndCountAll({
      include: [
        {
          model: allModels.UserRole,
          attributes: ["id", "role_name"],
        },
      ],
      attributes: [
        "id",
        "name",
        "email",
        "code",
        "role_id",
        "school_id",
        "profile_image",
        "createdAt",
      ],

      where: where,
      limit: limit,
      offset: offset,
      order: order,
      distinct: true,
    });

  return {
    totalObjects,
    objects,
  };
};

const getUserById = async (id) => {
  return await allModels.User.findByPk(id, {
    include: [
      {
        model: allModels.UserRole,
        attributes: ["id", "role_name"],
      },
    ],
    attributes: [
      "id",
      "name",
      "email",
      "code",
      "role_id",
      "school_id",
      "profile_image",
      "createdAt",
    ],
  });
};

const createUser = async (data) => {
  const password = data.password;

  const hashedPassword = await bcrypt.hash(password, 10);

  return await allModels.User.create({
    code: data.code,
    email: data.email,
    name: data.name,
    password: hashedPassword,
    role_id: data.role_id,
    // profile_image: profileUrl + data.code,
  });
};

const updateUser = async (id, data) => {
  const user = await allModels.User.findByPk(id);
  if (user) {
    return await user.update(data);
  }
  return null;
};

const deleteUser = async (id) => {
  const user = await allModels.User.findByPk(id);
  if (user) {
    await user.destroy();
    return true;
  }
  return false;
};

// Function to read the HTML file and replace placeholders with actual data
const getHtmlContent = (fileName, replacements = {}) => {
  const filePath = path.join(__dirname, "../public", fileName);
  let htmlContent = fs.readFileSync(filePath, "utf8");

  Object.keys(replacements).forEach((key) => {
    htmlContent = htmlContent.replace(
      new RegExp(`{{${key}}}`, "g"),
      replacements[key]
    );
  });

  return htmlContent;
};

const mailOptions = (to, userName, userCode, password, loginUrl) => {
  const htmlContent = getHtmlContent("mailBody.html", {
    name: userName,
    userCode,
    password,
    action_url: loginUrl,
  });

  return {
    from: {
      name: "Teacher Assistant Bot",
      address: process.env.EMAIL_USER,
    },
    to: [to],
    subject: "Registration",
    html: htmlContent,
  };
};

async function createUsersBulk(transporter, data, schoolId) {
  const ACTION_URL = "https://teachas.online";
  const transaction = await allModels.sequelize.transaction();

  try {
    for (const userData of data) {
      let user = await allModels.User.findOne({
        where: { code: userData.userCode },
        transaction,
      });

      if (!user) {
        const thatUserPassword = await bcrypt.hash("Pass@123", 10);
        user = await allModels.User.create(
          {
            name: userData.userName,
            email: userData.userEmail,
            code: userData.userCode,
            password: thatUserPassword,
            role_id: 2,
            school_id: schoolId,
            // profile_image: profileUrl + data.userCode,
          },
          { transaction }
        );

        // Send email here, so only new users receive it
        // console.log(userData.userEmail);
        if (userData.userEmail) {
          const options = mailOptions(
            userData.userEmail,
            userData.userName,
            userData.userCode,
            "Pass@123",
            ACTION_URL
          );
          await transporter.sendMail(options);
        }
      }

      if (!userData.subjectCode) {
        console.error("subjectCode is undefined for userData:", userData);
        continue;
      }

      const uniqueLessonTypeIds = [
        ...new Set(userData.schedules.map((schedule) => schedule.lessonTypeId)),
      ];

      // console.log(uniqueLessonTypeIds);

      let subject = await allModels.Subject.findOne({
        where: {
          subject_code: userData.subjectCode,
          user_id: user.id,
        },
        transaction,
      });
      if (!subject) {
        // subject = await allModels.Subject.create(
        //   {
        //     subject_name: userData.subjectName,
        //     subject_code: userData.subjectCode,
        //     user_id: user.id,
        //   },
        //   { transaction }
        // );
        subject = await subjectService.createSubject(
          {
            subject_name: userData.subjectName,
            subject_code: userData.subjectCode,
            user_id: user.id,
            subject_schedules: uniqueLessonTypeIds,
          },
          user.id,
          transaction
        );
      }

      for (const uniqueLessonTypeId of uniqueLessonTypeIds) {
        await allModels.SubjectLessonType.create(
          {
            subject_id: subject.id,
            lesson_type_id: uniqueLessonTypeId,
          },
          { transaction }
        );
      }

      const subjectSchedules = [];

      for (const scheduleInfo of userData.schedules) {
        const schedule = await allModels.Schedule.findOne({
          where: {
            schedule_day: scheduleInfo.day,
            schedule_time: scheduleInfo.time,
          },
          transaction,
        });

        if (schedule) {
          subjectSchedules.push({
            subject_id: subject.id,
            lesson_type_id: scheduleInfo.lessonTypeId,
            schedule_id: schedule.id,
          });
        }
      }

      if (subjectSchedules.length > 0) {
        await allModels.SubjectSchedule.bulkCreate(subjectSchedules, {
          transaction,
        });
      }
    }

    // Commit the transaction after all operations are successful
    await transaction.commit();
  } catch (error) {
    // Roll back the transaction in case of an error
    await transaction.rollback();
    throw error;
  }
}

async function processUsersFromExcelService(filepath, bodyData, schoolId) {
  const extractedData = await readExcelAndExtractData(filepath);

  const createdUsers = await createUsersBulk(
    transporter,
    extractedData,
    schoolId
  );
  return createdUsers;

  return extractedData;
}

async function readExcelAndExtractData(filepath) {
  function columnToLetter(column) {
    let temp;
    let letter = "";
    let col = column;
    while (col > 0) {
      temp = (col - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      col = (col - temp - 1) / 26;
    }
    return letter;
  }

  function determineDayAndTime(columnNumber) {
    const days = ["1", "2", "3", "4", "5"];
    const totalColumns = COLUMNS_PER_DAY * DAY_COUNT;
    const dayIndex = Math.floor(
      ((columnNumber - MONDAY_START_COLUMN_NO) % totalColumns) / COLUMNS_PER_DAY
    );
    const timeSlot =
      ((columnNumber - MONDAY_START_COLUMN_NO) % COLUMNS_PER_DAY) + 1; // Time slots start from 1

    return {
      day: days[dayIndex] || "Day out of range",
      time: timeSlot,
    };
  }
  function getLessonTypeByCode(code) {
    const object = LESSON_TYPE_DATAS.find(
      (obj) => obj.lesson_type_code_for_excel === code
    );
    return object ? object : null;
  }
  function getScheduleByDayAndTime(day, time) {
    const object = SCHEDULE_DATAS.find(
      (obj) => obj.schedule_day === day && obj.schedule_time === time
    );
    return object ? object : null;
  }

  const CELL_MAP = {
    subjectCellIndex: "B",
    userNameCellIndex: "C",
    userEmailCellIndex: "D",
    startDayColumnIndex: "G",
  };
  const MONDAY_START_COLUMN_NO = 7;
  const COLUMNS_PER_DAY = 7;
  const HEADER_ROW_COUNT = 3;
  const DAY_COUNT = 5;
  const USER_NAME_CELL_REGEX = /^(\w+\.\w+)\s*\/(.+?)\//;
  const SUBJECT_CELL_REGEX = /^(\w+\.\w+)\s*-\s*(.+)/;
  const EVEN_ODD = "т/с";
  const EVEN_LESSON_TYPE_TAIL_CODE = "сонд";
  const ODD_LESSON_TYPE_TAIL_CODE = "тэгш";
  const ONLINE_WORD = "цахим";
  const LESSON_TYPE_DATAS = await lessonTypeService.getAllLessonTypes({
    isWithoutBody: true,
  });
  const SCHEDULE_DATAS = await scheduleService.getAllSchedulesService();

  const SCHEDULE_REGEX_PATTERN = new RegExp(
    `(${LESSON_TYPE_DATAS.map((type) => type.lesson_type_code_for_excel).join(
      "|"
    )})` + // Match lesson type code
      `(?:\\s+((?:\\d+|\\w+)-\\w+|${ONLINE_WORD}))?` + // Match class number like "6-124" or words like "цахим", making it optional
      `(?:\\s+(${ODD_LESSON_TYPE_TAIL_CODE}|${EVEN_LESSON_TYPE_TAIL_CODE}|${EVEN_ODD}))?`, // Match week type indicators, also optional
    "i"
  );

  const workbook = XLSX.readFile(filepath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = [];

  let lastValidSubject = null;

  for (
    let row = HEADER_ROW_COUNT;
    row <= sheet["!ref"].split(":")[1].match(/\d+/)[0];
    row++
  ) {
    const userNameCell = sheet[`${CELL_MAP.userNameCellIndex}${row}`];
    const userEmailCell = sheet[`${CELL_MAP.userEmailCellIndex}${row}`];
    const subjectCell = sheet[`${CELL_MAP.subjectCellIndex}${row}`];

    if (subjectCell && subjectCell.v.trim()) {
      // Extract subject from the current row
      const subjectMatch = subjectCell.v.match(SUBJECT_CELL_REGEX);
      if (subjectMatch) {
        lastValidSubject = subjectMatch;
      }
    } else if (!lastValidSubject) {
      // Skip rows until a new valid subject is found if there is no lastValidSubject set
      continue;
    }
    if (userNameCell && userNameCell.v) {
      const userMatch = userNameCell.v.match(USER_NAME_CELL_REGEX);
      let subjectMatch = subjectCell && subjectCell.v.match(SUBJECT_CELL_REGEX);

      if (!subjectMatch && lastValidSubject) {
        subjectMatch = lastValidSubject;
      }

      // if (subjectMatch) {
      //   console.log(subjectMatch);
      // } else {
      //   console.log(not);
      // }

      if (userMatch) {
        const schedules = [];

        for (
          let colNum = MONDAY_START_COLUMN_NO;
          colNum < MONDAY_START_COLUMN_NO + COLUMNS_PER_DAY * DAY_COUNT;
          colNum++
        ) {
          let colLetter = columnToLetter(colNum);
          const cellAddress = `${colLetter}${row}`;
          const scheduleCell = sheet[cellAddress];

          if (scheduleCell && scheduleCell.v.trim()) {
            const scheduleText = scheduleCell.v.trim().toLowerCase();
            const scheduleParts = scheduleText.match(SCHEDULE_REGEX_PATTERN);

            // console.log(scheduleParts);

            if (scheduleParts) {
              const { day, time } = determineDayAndTime(colNum);
              const schedule = getScheduleByDayAndTime(day, time.toString());
              const classNumber = scheduleParts[2];

              // Check the week type indicator
              const weekTypeIndicator = scheduleParts[3]?.trim().toLowerCase();

              // Find the base lesson type
              const lessonTypeCode = scheduleParts[1].toLowerCase();
              let baseLessonType = getLessonTypeByCode(lessonTypeCode);

              // Handle specific week types
              if (weekTypeIndicator) {
                let weekTypeLessonTypes = [];
                if (weekTypeIndicator === EVEN_ODD) {
                  // If "т/с", create two schedule entries
                  weekTypeLessonTypes.push(
                    getLessonTypeByCode(
                      `${lessonTypeCode}${EVEN_LESSON_TYPE_TAIL_CODE}`
                    )
                  );
                  weekTypeLessonTypes.push(
                    getLessonTypeByCode(
                      `${lessonTypeCode}${ODD_LESSON_TYPE_TAIL_CODE}`
                    )
                  );
                } else {
                  // For "тэгш" or "сондгой", modify the lesson type
                  weekTypeLessonTypes.push(
                    getLessonTypeByCode(`${lessonTypeCode}${weekTypeIndicator}`)
                  );
                  // console.log(`${lessonTypeCode}${weekTypeIndicator}`);
                }

                weekTypeLessonTypes.forEach((weekTypeLessonType) => {
                  schedules.push({
                    day: day,
                    time: time.toString(),
                    scheduleName: schedule?.schedule_name,
                    lessonType: weekTypeLessonType?.lesson_type_name,
                    lessonTypeId: weekTypeLessonType?.id,
                    classNumber: classNumber,
                    // weekType: weekTypeIndicator,
                    // subjectCode: subjectMatch[1],
                    // subjectName: subjectMatch[2],
                  });
                });
              } else {
                schedules.push({
                  day: day,
                  time: time.toString(),
                  scheduleName: schedule?.schedule_name,
                  lessonType: baseLessonType?.lesson_type_name,
                  lessonTypeId: baseLessonType?.id,
                  classNumber: classNumber,
                  // weekType: weekTypeIndicator,
                  // subjectCode: subjectMatch[1],
                  // subjectName: subjectMatch[2],
                });
              }
            } else if (scheduleText) {
              console.warn(
                `Unexpected schedule format in cell ${cellAddress}: ${scheduleText}`
              );
            }
          }
        }

        if (subjectMatch) {
          data.push({
            userCode: userMatch[1],
            userName: userMatch[2].trim(),
            userEmail: userEmailCell?.v,
            subjectCode: subjectMatch[1],
            subjectName: subjectMatch[2],
            schedules: schedules,
          });
        }
      }
    }
  }

  return data;
}

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  processUsersFromExcelService,
};
