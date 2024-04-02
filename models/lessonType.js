const { Model, DataTypes } = require('sequelize');

class LessonType extends Model {
  static init(sequelize) {
    super.init({
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      lesson_type_name: {
        type: DataTypes.STRING(255),
      },
      lesson_type_code_for_excel: {
        type: DataTypes.STRING(255),
      },
    }, {
      sequelize,
      modelName: 'lesson_type',
      tableName: 'lesson_type', 
      timestamps: true,
    });
  }

  static associate(models) {
    this.hasMany(models.Lesson, { foreignKey: 'lesson_type_id' });
    this.hasMany(models.SubjectSchedule, { foreignKey: 'lesson_type_id' });
    this.hasMany(models.LessonAssessment, { foreignKey: 'lesson_type_id' });
    this.hasMany(models.SubjectLessonType, { foreignKey: "lesson_type_id" });
  }
}

module.exports = LessonType;
