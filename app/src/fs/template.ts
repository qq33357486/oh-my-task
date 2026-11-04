/**
 * fs 层模板再导出（T0035）：frameworkWriter.test（锁定契约）从
 * '../template' 导入 FRAMEWORK_FILES / FRAMEWORK_VERSION / RULES_SKELETON，
 * 数据唯一来源在 src/template（门面）与 src/template/bundle.gen.ts（生成
 * 产物）。此处只转发，不放任何数据，杜绝第二份清单。
 */
export * from '../template';
