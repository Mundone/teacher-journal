const express = require('express');
const gradeController = require('../controllers/gradeController');
const paginationMiddleware = require('../middlewares/paginationMiddleware');
const router = express.Router();


/**
 * @swagger
 * /get_grades:
 *   get:
 *     summary: Retrieve all grades
 *     tags: [Grade]
 *     parameters:
 *     - in: query
 *       name: search
 *       schema:
 *         type: string
 *       description: Optional search term to filter grades
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Grade'
 *       500:
 *         description: Internal Server Error
 */

router.get('/grades', paginationMiddleware, gradeController.getGrades); // Get grades for a specific week and subject



/**
 * @swagger
 * /get_grade/{id}:
 *   get:
 *     summary: Retrieve a single grade by ID
 *     tags: [Grade]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: The ID of the grade
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Grade'
 *       404:
 *         description: Not Found
 *       500:
 *         description: Internal Server Error
 */

router.put('/grades/:id', paginationMiddleware, gradeController.updateScore); // Update a specific grade

module.exports = router;