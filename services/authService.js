const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const allModels = require("../models");

const transporter = require("../config/email.config");
const fs = require("fs");
const path = require("path");

const registerUserService = async ({ code, name, password, roleID }) => {
  const existingUser = await allModels.User.findOne({ where: { code } });
  if (existingUser) {
    throw new Error("Хэрэглэгчийн код давтагдаж байна.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await User.create({
    code: code,
    name: name,
    password: hashedPassword,
    role_id: roleID,
  });

  return newUser;
};

const authenticateUserService = async (code, password) => {
  const inputUser = await allModels.User.findOne({
    where: { code },
    include: [
      {
        model: allModels.UserRole,
        attributes: ["id", "role_name"],
      },
    ],
  });
  const isMatch = await bcrypt.compare(password, inputUser?.password);
  if (!inputUser || !isMatch) {
    const error = new Error("Нууц үг буруу байна.");
    error.statusCode = 403;
    throw error;
  }

  const token = jwt.sign(
    { id: inputUser?.id, code: inputUser?.code, role_id: inputUser?.role_id },
    process.env.JWT_SECRET,
    // { expiresIn: "72h" }
  );

  var user = {
    id: inputUser?.id,
    name: inputUser?.name,
    email: inputUser?.email,
    code: inputUser?.code,
    role_id: inputUser?.role_id,
    user_role: inputUser?.user_role,
  };

  const userMenus = await allModels.Menu.findAll({
    include: [
      {
        model: allModels.UserRoleMenu,
        where: { user_role_id: user.role_id },
        include: [
          {
            model: allModels.UserRole,
            where: { id: user.role_id },
            attributes: [],
          },
        ],
        attributes: [],
      },
    ],
    order: [
      ["parent_id", "ASC"],
      ["sorted_order", "ASC"],
    ],
  });

  const menusJson = userMenus.map((menu) => menu.toJSON());

  let menuMap = {};
  menusJson.forEach((menu) => {
    if (menu.parent_id === 0) {
      menu.ChildMenu = [];
    }
    menuMap[menu.id] = menu;

    if (menu.parent_id !== 0) {
      if (menuMap[menu.parent_id]) {
        menuMap[menu.parent_id].ChildMenu.push(menu);
        delete menu.ChildMenu;
      } else {
        menuMap[menu.parent_id] = { ChildMenu: [menu] };
      }
    }
  });

  let topLevelMenus = Object.values(menuMap).filter(
    (menu) => menu.parent_id === 0
  );

  return { user, token, UserMenus: topLevelMenus };
};

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

const mailOptionsStudent = (to, password, loginUrl) => {
  const htmlContent = getHtmlContent("mailBodyStudent.html", {
    password,
    action_url: loginUrl,
  });

  return {
    from: {
      name: "Teacher Assistant Bot",
      address: process.env.EMAIL_USER,
    },
    to: [to],
    subject: "OTP for student",
    html: htmlContent,
  };
};

function generateCode(length) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  return result;
}

const sendEmailStudentService = async (email) => {
  const ACTION_URL = "https://teachas.online";

  let inputStudent = await allModels.Student.findOne({
    where: { email },
  });

  if (!inputStudent) {
    inputStudent = allModels.Student.create({ email });
  }
  password = generateCode(6);

  const options = mailOptionsStudent(
    inputStudent.email,
    password,
    ACTION_URL
  );

  await transporter.sendMail(options);
  const hashedPassword = await bcrypt.hash(password, 10);

  return await allModels.Student.update(
    { password: hashedPassword },
    {
      where: { id: inputStudent.id },
    }
  );
};

const authenticateStudentService = async (email, password) => {
  const inputStudent = await allModels.Student.findOne({
    where: { email },
  });
  const isMatch = await bcrypt.compare(password, inputStudent?.password);
  if (!inputStudent || !isMatch) {
    const error = new Error("Имейл рүү явсан код буруу байна.");
    error.statusCode = 403;
    throw error;
  }

  const token = jwt.sign(
    {
      id: inputStudent?.id,
      name: inputStudent?.name,
      code: inputStudent?.student_code,
      email: inputStudent?.email,
    },
    process.env.JWT_SECRET
  );

  var user = {
    id: inputStudent?.id,
    name: inputStudent?.name,
    student_code: inputStudent?.student_code,
    email: inputStudent?.email,
  };

  return { user, token };
};

// Service
const refreshTokenService = async (userId) => {
  const user = await allModels.User.findByPk(userId, {
    include: [
      {
        model: allModels.UserRole,
        attributes: ["id", "role_name"],
      },
    ],
    attributes: ["id", "name", "email", ["code", "teacher_code"], "role_id"],
  });
  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  const userMenus = await allModels.Menu.findAll({
    include: [
      {
        model: allModels.UserRoleMenu,
        where: { user_role_id: user.role_id },
        include: [
          {
            model: allModels.UserRole,
            where: { id: user.role_id },
            attributes: [],
          },
        ],
        attributes: [],
      },
    ],
    order: [
      ["parent_id", "ASC"],
      ["sorted_order", "ASC"],
    ],
  });

  const menusJson = userMenus.map((menu) => menu.toJSON());

  let menuMap = {};
  menusJson.forEach((menu) => {
    if (menu.parent_id === 0) {
      menu.ChildMenu = [];
    }
    menuMap[menu.id] = menu;

    if (menu.parent_id !== 0) {
      if (menuMap[menu.parent_id]) {
        menuMap[menu.parent_id].ChildMenu.push(menu);
        delete menu.ChildMenu;
      } else {
        menuMap[menu.parent_id] = { ChildMenu: [menu] };
      }
    }
  });

  let topLevelMenus = Object.values(menuMap).filter(
    (menu) => menu.parent_id === 0
  );

  return { user, UserMenus: topLevelMenus };
};

// Service
const refreshTokenStudentService = async (userId) => {
  const student = await allModels.Student.findByPk(userId, {
    // include: [
    //   {
    //     model: allModels.UserRole,
    //     attributes: ["id", "role_name"],
    //   },
    // ],
    // attributes: ["id", "name", "email", ["code", "teacher_code"], "role_id"],
  });
  if (!student) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }
  return { user };
};

module.exports = {
  registerUserService,
  authenticateUserService,
  refreshTokenService,
  authenticateStudentService,
  refreshTokenStudentService,
  sendEmailStudentService,
};
