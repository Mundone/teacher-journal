const subjectScheduleService = require("../services/subjectScheduleService");
const buildWhereOptions = require("../utils/sequelizeUtil");
const responses = require("../utils/responseUtil");

const getSubjectSchedules = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    // const roleId = req.user && req.user.role_id;
    // if (roleId != 1 && roleId != 2 && roleId != 3) {
    //   return res.status(403).json({ message: "Зөвшөөрөлгүй хандалт." });
    // }

    // Include the user ID in the pagination filters
    // req.pagination.filters.push({
    //   fieldName: "user_id",
    //   operation: "eq",
    //   value: userId,
    // });
    // const subjectId = req.body.subject_id ?? null;

    const { pageNo, pageSize, sortBy, sortOrder, filters } = req.pagination;

    const { subjectId } = req.params;
    const queryOptions = {
      // Assuming you have a function that translates filters to Sequelize where options
      where: buildWhereOptions(filters),
      limit: pageSize,
      offset: pageNo * pageSize,
      order: [[sortBy, sortOrder]],
      userId: userId,
      subjectId: subjectId,
    };

    // console.log(req);

    const { totalSubjectSchedules, subjectSchedules } =
      await subjectScheduleService.getAllSubjectSchedules(queryOptions);

    res.json({
      pagination: {
        current_page_no: pageNo + 1, // Since pageNo in the response should be one-based
        total_pages: Math.ceil(totalSubjectSchedules / pageSize),
        per_page: pageSize,
        total_elements: totalSubjectSchedules,
      },
      data: subjectSchedules,
    });
  } catch (error) {
    if (error.statusCode == 403) {
      responses.forbidden(res, error);
    } else {
      responses.internalServerError(res, error);
    }
  }
};

const getSubjectSchedulesForDropdown = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const { subjectId } = req.params;

    const subjectSchedules =
      await subjectScheduleService.getAllSubjectSchedules({
        subjectId,
        isWithoutBody: true,
        userId,
      });

    const groupedByLessonType = subjectSchedules.reduce(
      (accumulator, current) => {
        const { lesson_type_id, id, schedule, lesson_type } = current;
        const lessonTypeKey = `lesson_type_${lesson_type_id}`;

        if (!accumulator[lessonTypeKey]) {
          accumulator[lessonTypeKey] = {
            lesson_type: current.lesson_type,
            subject_schudule: [],
          };
        }

        accumulator[lessonTypeKey].subject_schudule.push({
          id,
          schedule_name:
            lesson_type.lesson_type_name + " - " + schedule.schedule_name,
        });

        return accumulator;
      },
      {}
    );

    const newSubjectSchedules = Object.values(groupedByLessonType);

    res.json({ data: newSubjectSchedules });
  } catch (error) {
    if (error.statusCode == 403) {
      responses.forbidden(res, error);
    } else {
      responses.internalServerError(res, error);
    }
  }
};

const getSubjectSchedulesForDropdownAttendance = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const { subjectId } = req.params;

    const subjectSchedules =
      await subjectScheduleService.getAllSubjectSchedules({
        subjectId,
        isWithoutBody: true,
        userId,
        isForAttendance: true
      });

    const groupedByLessonType = subjectSchedules.reduce(
      (accumulator, current) => {
        const { lesson_type_id, id, schedule, lesson_type } = current;
        const lessonTypeKey = `lesson_type_${lesson_type_id}`;

        if (!accumulator[lessonTypeKey]) {
          accumulator[lessonTypeKey] = {
            lesson_type: current.lesson_type,
            subject_schudule: [],
          };
        }

        accumulator[lessonTypeKey].subject_schudule.push({
          id,
          schedule_name:
            lesson_type.lesson_type_name + " - " + schedule.schedule_name,
        });

        return accumulator;
      },
      {}
    );

    const newSubjectSchedules = Object.values(groupedByLessonType);

    res.json({ data: newSubjectSchedules });
  } catch (error) {
    if (error.statusCode == 403) {
      responses.forbidden(res, error);
    } else {
      responses.internalServerError(res, error);
    }
  }
};

const getSubjectSchedulesWithoutBody = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const { subjectId } = req.params;
    const subjectSchedules =
      await subjectScheduleService.getAllSubjectSchedules({
        subjectId,
        isWithoutBody: true,
        userId,
      });
    res.json({ data: subjectSchedules });
  } catch (error) {
    if (error.statusCode == 403) {
      responses.forbidden(res, error);
    } else {
      responses.internalServerError(res, error);
    }
  }
};

const getSubjectSchedule = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const { id } = req.params;
    const subjectSchedule = await subjectScheduleService.getSubjectScheduleById(
      id,
      userId
    );
    res.json(subjectSchedule);
  } catch (error) {
    if (error.statusCode == 403) {
      responses.forbidden(res, error);
    } else {
      responses.internalServerError(res, error);
    }
  }
};

const createSubjectSchedule = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    // if (!userId) {
    //   return res
    //     .status(403)
    //     .json({ message: "User ID is required to create a subjectSchedule." });
    // }

    const newObject = await subjectScheduleService.createSubjectSchedule(
      req.body,
      userId
    );
    responses.created(res, newObject);
  } catch (error) {
    if (error.statusCode == 403) {
      responses.forbidden(res, error);
    } else {
      responses.internalServerError(res, error);
    }
  }
};

const updateSubjectSchedule = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const { id } = req.params;
    await subjectScheduleService.updateSubjectSchedule(id, req.body, userId);
    responses.updated(res, req.body);
  } catch (error) {
    if (error.statusCode == 403) {
      responses.forbidden(res, error);
    } else {
      responses.internalServerError(res, error);
    }
  }
};

const deleteSubjectSchedule = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const { id } = req.params;
    await subjectScheduleService.deleteSubjectSchedule(id, userId);
    responses.deleted(res, { id: id });
  } catch (error) {
    if (error.statusCode == 403) {
      responses.forbidden(res, error);
    } else {
      responses.internalServerError(res, error);
    }
  }
};

module.exports = {
  getSubjectSchedules,
  getSubjectSchedulesWithoutBody,
  getSubjectSchedule,
  createSubjectSchedule,
  updateSubjectSchedule,
  deleteSubjectSchedule,
  getSubjectSchedulesForDropdown,
  getSubjectSchedulesForDropdownAttendance,
};
